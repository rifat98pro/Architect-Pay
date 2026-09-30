'use server'

import { encodeFunctionData, encodePacked, pad } from 'viem'
import { executeContractCall, waitForTransaction } from '@/lib/circle'
import {
  SOURCE_CHAIN_META, ARC_TESTNET_CONFIG, CCTS_ADDRESS, EURC_CCTPX_TOKEN_ID,
  type CctpSourceChain,
} from '@/lib/cctp-chains'

const IRIS_API = 'https://iris-api-sandbox.circle.com'

const APPROVE_ABI = {
  type:             'function' as const,
  name:             'approve',
  stateMutability:  'nonpayable' as const,
  inputs:           [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs:          [{ name: '', type: 'bool' }],
}

// USDC: CCTP V2 7-arg depositForBurn (TokenMessengerV2)
const DEPOSIT_FOR_BURN_ABI = {
  type:            'function' as const,
  name:            'depositForBurn',
  stateMutability: 'nonpayable' as const,
  inputs: [
    { name: 'amount',               type: 'uint256' },
    { name: 'destinationDomain',    type: 'uint32'  },
    { name: 'mintRecipient',        type: 'bytes32' },
    { name: 'burnToken',            type: 'address' },
    { name: 'destinationCaller',    type: 'bytes32' },
    { name: 'maxFee',               type: 'uint256' },
    { name: 'minFinalityThreshold', type: 'uint32'  },
  ],
  outputs: [],
}

// EURC: CrossChainTokenService crossChainTransfer
const CROSS_CHAIN_TRANSFER_ABI = {
  type:            'function' as const,
  name:            'crossChainTransfer',
  stateMutability: 'payable' as const,
  inputs: [
    { name: 'tokenId',              type: 'bytes32' },
    { name: 'amount',               type: 'uint256' },
    { name: 'destinationDomain',    type: 'uint32'  },
    { name: 'destinationAddress',   type: 'bytes'   },
    { name: 'destinationCaller',    type: 'bytes32' },
    { name: 'minFinalityThreshold', type: 'uint32'  },
    {
      name: 'claim', type: 'tuple',
      components: [
        { name: 'signedQuote',   type: 'bytes'   },
        { name: 'refundAddress', type: 'address' },
      ],
    },
    { name: 'autoExecuteHookData',  type: 'bool'    },
    { name: 'hookData',             type: 'bytes'   },
  ],
  outputs: [],
}

const RECEIVE_MESSAGE_ABI = {
  type:            'function' as const,
  name:            'receiveMessage',
  stateMutability: 'nonpayable' as const,
  inputs:  [{ name: 'message', type: 'bytes' }, { name: 'attestation', type: 'bytes' }],
  outputs: [],
}

function toMicroUsdc(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 1_000_000))
}

async function pollAttestationByTxHash(srcDomain: number, burnTxHash: string): Promise<{ message: string; attestation: string }> {
  const url   = `${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`
  const LIMIT = 120
  const DELAY = 5_000

  for (let i = 0; i < LIMIT; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const msg  = data?.messages?.[0]
        if (msg?.status === 'complete' && msg?.attestation && msg?.message) {
          return { message: msg.message as string, attestation: msg.attestation as string }
        }
      }
    } catch { /* network blip */ }
    await new Promise((r) => setTimeout(r, DELAY))
  }
  throw new Error('Iris attestation timed out after 10 minutes')
}

// Single non-blocking check — returns null if attestation not yet available.
export async function checkAttestationOnce(srcDomain: number, burnTxHash: string): Promise<{ message: string; attestation: string } | null> {
  try {
    const url = `${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const msg  = data?.messages?.[0]
    if (msg?.status === 'complete' && msg?.attestation && msg?.message) {
      return { message: msg.message as string, attestation: msg.attestation as string }
    }
    return null
  } catch {
    return null
  }
}

// Mint phase only — call after checkAttestationOnce returns non-null.
export async function mintFromAttestation({
  message,
  attestation,
  receiverWalletId,
  destTransmitter,
}: {
  message:          string
  attestation:      string
  receiverWalletId: string
  destTransmitter:  string
}): Promise<string> {
  const mintTxId = await executeContractCall({
    walletId:        receiverWalletId,
    contractAddress: destTransmitter,
    callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
  })
  const mintTxHash = await waitForTransaction(mintTxId).catch((e: Error) => { throw new Error(`[mint-receiveMessage] ${e.message}`) })
  console.log(`[cctp] mint confirmed: ${mintTxHash}`)
  return mintTxHash
}

// ── EURC CCTPx helpers ────────────────────────────────────────────────────────

async function getCctpxQuote(srcDomain: number, dstDomain: number, amountMicro: bigint): Promise<{
  signedQuote: `0x${string}`
}> {
  // Standard finality (2000) with empty requests → feeTotalAmount = 0, no native token needed
  const res = await fetch(
    `${IRIS_API}/v2/quote/cctpx/${EURC_CCTPX_TOKEN_ID}/${srcDomain}/${dstDomain}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount: amountMicro.toString(), feeToken: '0x0000000000000000000000000000000000000000', requests: [] }),
    },
  )
  if (!res.ok) throw new Error(`CCTPx quote failed: ${await res.text()}`)
  const data = await res.json() as { signedQuote: `0x${string}`; feeTotalAmount: string }
  console.log(`[cctp/eurc] CCTPx quote feeTotalAmount: ${data.feeTotalAmount}`)
  return { signedQuote: data.signedQuote }
}

// ── Phase 1: Burn (approve + burn) ────────────────────────────────────────────
// Returns quickly so the API route can respond before Vercel's 60s timeout.

export async function cctpBurn({
  sourceChain,
  sourceWalletId,
  destChain,
  destWalletId,
  arcWalletId,
  recipientAddress,
  amount,
  token = 'USDC',
}: {
  sourceChain:      CctpSourceChain
  sourceWalletId:   string
  destChain?:       CctpSourceChain
  destWalletId?:    string
  arcWalletId:      string
  recipientAddress: string
  amount:           string
  token?:           'USDC' | 'EURC'
}): Promise<{ burnTxHash: string; srcDomain: number; receiverWalletId: string; destTransmitter: string }> {
  const srcMeta          = SOURCE_CHAIN_META[sourceChain]
  const dstMeta          = destChain ? SOURCE_CHAIN_META[destChain] : null
  const dstDomain        = dstMeta ? dstMeta.cctpDomain : ARC_TESTNET_CONFIG.cctpDomain
  const receiverWalletId = destWalletId ?? arcWalletId
  const destTransmitter  = dstMeta ? dstMeta.messageTransmitterV2 : ARC_TESTNET_CONFIG.messageTransmitterV2
  const amountMicro      = toMicroUsdc(amount)
  const zeroCaller       = pad('0x0', { size: 32 })

  if (token === 'EURC') {
    const eurcAddress  = srcMeta.eurcAddress
    const tokenManager = srcMeta.eurcTokenManager
    if (!eurcAddress)  throw new Error(`EURC is not supported on ${sourceChain}`)
    if (!tokenManager) throw new Error(`EURC TokenManager not configured for ${sourceChain}`)

    console.log(`[cctp/eurc] burn phase: ${sourceChain} → ${destChain ?? 'ARC-TESTNET'}`)

    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: eurcAddress,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [tokenManager, amountMicro] }),
    })
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })

    const { signedQuote } = await getCctpxQuote(srcMeta.cctpDomain, dstDomain, amountMicro)

    const destAddress  = encodePacked(['address'], [recipientAddress as `0x${string}`])
    const transferTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: CCTS_ADDRESS,
      callData:        encodeFunctionData({
        abi: [CROSS_CHAIN_TRANSFER_ABI],
        functionName: 'crossChainTransfer',
        args: [
          EURC_CCTPX_TOKEN_ID, amountMicro, dstDomain, destAddress, zeroCaller,
          2000,
          { signedQuote, refundAddress: '0x0000000000000000000000000000000000000000' },
          false, '0x',
        ],
      }),
    })
    const burnTxHash = await waitForTransaction(transferTxId).catch((e: Error) => { throw new Error(`[step2-crossChainTransfer] ${e.message}`) })
    console.log(`[cctp/eurc] burn confirmed: ${burnTxHash}`)
    return { burnTxHash, srcDomain: srcMeta.cctpDomain, receiverWalletId, destTransmitter }

  } else {
    const burnToken   = srcMeta.usdcAddress
    const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })

    console.log(`[cctp/usdc] burn phase: ${sourceChain} → ${destChain ?? 'ARC-TESTNET'}`)

    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: burnToken,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, amountMicro] }),
    })
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })

    const burnTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: srcMeta.tokenMessengerV2,
      callData:        encodeFunctionData({ abi: [DEPOSIT_FOR_BURN_ABI], functionName: 'depositForBurn', args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, BigInt(0), 1000] }),
    })
    const burnTxHash = await waitForTransaction(burnTxId).catch((e: Error) => { throw new Error(`[step2-depositForBurn] ${e.message}`) })
    console.log(`[cctp/usdc] burn confirmed: ${burnTxHash}`)
    return { burnTxHash, srcDomain: srcMeta.cctpDomain, receiverWalletId, destTransmitter }
  }
}

// ── Phase 1 (fast): Submit burn without waiting for on-chain confirmation ────────
// Returns the Circle transaction ID immediately. The caller stores it and polls
// /api/payments/[id]/mint which checks Circle tx state → Iris attestation → mints.

export async function cctpBurnFast({
  sourceChain,
  sourceWalletId,
  destChain,
  destWalletId,
  arcWalletId,
  recipientAddress,
  amount,
  token = 'USDC',
}: Parameters<typeof cctpBurn>[0]): Promise<{
  burnCircleTxId: string
  srcDomain:        number
  receiverWalletId: string
  destTransmitter:  string
}> {
  const srcMeta          = SOURCE_CHAIN_META[sourceChain]
  const dstMeta          = destChain ? SOURCE_CHAIN_META[destChain] : null
  const dstDomain        = dstMeta ? dstMeta.cctpDomain : ARC_TESTNET_CONFIG.cctpDomain
  const receiverWalletId = destWalletId ?? arcWalletId
  const destTransmitter  = dstMeta ? dstMeta.messageTransmitterV2 : ARC_TESTNET_CONFIG.messageTransmitterV2
  const amountMicro      = toMicroUsdc(amount)
  const zeroCaller       = pad('0x0', { size: 32 })

  if (token === 'EURC') {
    const eurcAddress  = srcMeta.eurcAddress
    const tokenManager = srcMeta.eurcTokenManager
    if (!eurcAddress)  throw new Error(`EURC is not supported on ${sourceChain}`)
    if (!tokenManager) throw new Error(`EURC TokenManager not configured for ${sourceChain}`)

    const { signedQuote } = await getCctpxQuote(srcMeta.cctpDomain, dstDomain, amountMicro)

    // Wait for approve to confirm — burn requires the allowance to be set on-chain
    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: eurcAddress,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [tokenManager, amountMicro] }),
    })
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })

    // Submit burn — don't wait, return Circle tx ID immediately
    const destAddress    = encodePacked(['address'], [recipientAddress as `0x${string}`])
    const burnCircleTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: CCTS_ADDRESS,
      callData:        encodeFunctionData({
        abi: [CROSS_CHAIN_TRANSFER_ABI],
        functionName: 'crossChainTransfer',
        args: [
          EURC_CCTPX_TOKEN_ID, amountMicro, dstDomain, destAddress, zeroCaller,
          2000,
          { signedQuote, refundAddress: '0x0000000000000000000000000000000000000000' },
          false, '0x',
        ],
      }),
    })

    console.log(`[cctp/eurc] burn submitted (no-wait): circleId=${burnCircleTxId}`)
    return { burnCircleTxId, srcDomain: srcMeta.cctpDomain, receiverWalletId, destTransmitter }

  } else {
    const burnToken   = srcMeta.usdcAddress
    const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })

    // Wait for approve to confirm — depositForBurn requires allowance to be on-chain
    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: burnToken,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, amountMicro] }),
    })
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })

    // Submit burn — don't wait, return Circle tx ID immediately
    const burnCircleTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: srcMeta.tokenMessengerV2,
      callData:        encodeFunctionData({ abi: [DEPOSIT_FOR_BURN_ABI], functionName: 'depositForBurn', args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, BigInt(0), 1000] }),
    })

    console.log(`[cctp/usdc] burn submitted (no-wait): circleId=${burnCircleTxId}`)
    return { burnCircleTxId, srcDomain: srcMeta.cctpDomain, receiverWalletId, destTransmitter }
  }
}

// ── Phase 2: Mint (attestation + receiveMessage) ───────────────────────────────
// Called by the cron job once Iris issues the attestation.

export async function cctpMint({
  burnTxHash,
  srcDomain,
  receiverWalletId,
  destTransmitter,
}: {
  burnTxHash:       string
  srcDomain:        number
  receiverWalletId: string
  destTransmitter:  string
}): Promise<string> {
  const { message, attestation } = await pollAttestationByTxHash(srcDomain, burnTxHash)

  const mintTxId = await executeContractCall({
    walletId:        receiverWalletId,
    contractAddress: destTransmitter,
    callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
  })
  const mintTxHash = await waitForTransaction(mintTxId).catch((e: Error) => { throw new Error(`[mint-receiveMessage] ${e.message}`) })
  console.log(`[cctp] mint confirmed: ${mintTxHash}`)
  return mintTxHash
}

// ── Combined (burn + mint) — for flows that need synchronous completion ────────
// Used by aggregate-send and payroll where the mint must finish before next step.

export async function cctpTransfer(params: Parameters<typeof cctpBurn>[0]): Promise<{ burnTxHash: string; mintTxHash: string }> {
  const burn = await cctpBurn(params)
  const mintTxHash = await cctpMint(burn)
  return { burnTxHash: burn.burnTxHash, mintTxHash }
}
