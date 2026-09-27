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

// USDC: CCTP V2 7-arg depositForBurn
const DEPOSIT_FOR_BURN_V2_ABI = {
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

// ── USDC helpers ──────────────────────────────────────────────────────────────

async function getFee(srcDomain: number, dstDomain: number, amountMicro: bigint): Promise<{
  feeAmount:         bigint
  totalToApprove:    bigint
  finalityThreshold: number
}> {
  const url = `${IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch CCTP fee: ${res.status}`)

  const tiers = await res.json() as Array<{ finalityThreshold: number; minimumFee: number }>
  const sorted = [...tiers].sort((a, b) => a.finalityThreshold - b.finalityThreshold)
  const tier   = sorted[0]

  if (tier.minimumFee === 0) {
    return { feeAmount: BigInt(0), totalToApprove: amountMicro, finalityThreshold: tier.finalityThreshold }
  }

  const basisPoints = BigInt(Math.round(tier.minimumFee * 100))
  const feeAmount   = (amountMicro * basisPoints) / BigInt(10_000)
  return { feeAmount, totalToApprove: amountMicro + feeAmount, finalityThreshold: tier.finalityThreshold }
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

// ── Main transfer function ─────────────────────────────────────────────────────

export async function cctpTransfer({
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
}): Promise<{ burnTxHash: string; mintTxHash: string }> {
  const srcMeta          = SOURCE_CHAIN_META[sourceChain]
  const dstMeta          = destChain ? SOURCE_CHAIN_META[destChain] : null
  const dstDomain        = dstMeta ? dstMeta.cctpDomain : ARC_TESTNET_CONFIG.cctpDomain
  const receiverWalletId = destWalletId ?? arcWalletId
  const destTransmitter  = dstMeta ? dstMeta.messageTransmitterV2 : ARC_TESTNET_CONFIG.messageTransmitterV2
  const amountMicro      = toMicroUsdc(amount)
  const zeroCaller       = pad('0x0', { size: 32 })

  if (token === 'EURC') {
    // ── EURC: CrossChainTokenService (CCTPx) flow ─────────────────────────────
    // EURC does NOT use TokenMessengerV2/depositForBurn — it uses CCTS/crossChainTransfer.
    // Standard finality (2000) has feeTotalAmount=0 so no native token value needed.
    const eurcAddress    = srcMeta.eurcAddress
    const tokenManager   = srcMeta.eurcTokenManager
    if (!eurcAddress)  throw new Error(`EURC is not supported on ${sourceChain}`)
    if (!tokenManager) throw new Error(`EURC TokenManager not configured for ${sourceChain}`)

    console.log(`[cctp/eurc] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} via CCTPx`)

    // Step 1: approve TokenManager (not TokenMessengerV2)
    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: eurcAddress,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [tokenManager, amountMicro] }),
    })
    console.log(`[cctp/eurc] approve tx: ${approveTxId}`)
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })
    console.log('[cctp/eurc] approve confirmed')

    // Step 2: get CCTPx quote (standard finality, fee=0)
    const { signedQuote } = await getCctpxQuote(srcMeta.cctpDomain, dstDomain, amountMicro)

    // Step 3: crossChainTransfer on CCTS
    // destinationAddress = raw packed 20-byte address (NOT 32-byte padded)
    const destAddress = encodePacked(['address'], [recipientAddress as `0x${string}`])
    const transferTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: CCTS_ADDRESS,
      callData:        encodeFunctionData({
        abi: [CROSS_CHAIN_TRANSFER_ABI],
        functionName: 'crossChainTransfer',
        args: [
          EURC_CCTPX_TOKEN_ID,
          amountMicro,
          dstDomain,
          destAddress,
          zeroCaller,
          2000,                        // standard finality
          { signedQuote, refundAddress: '0x0000000000000000000000000000000000000000' },
          false,
          '0x',
        ],
      }),
    })
    console.log(`[cctp/eurc] transfer tx: ${transferTxId}`)
    const burnTxHash = await waitForTransaction(transferTxId).catch((e: Error) => { throw new Error(`[step3-crossChainTransfer] ${e.message}`) })
    console.log(`[cctp/eurc] transfer confirmed: ${burnTxHash}`)

    // Step 4: poll attestation by tx hash
    const { message, attestation } = await pollAttestationByTxHash(srcMeta.cctpDomain, burnTxHash)

    // Step 5: receiveMessage on destination
    const mintTxId = await executeContractCall({
      walletId:        receiverWalletId,
      contractAddress: destTransmitter,
      callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
    })
    console.log(`[cctp/eurc] mint tx: ${mintTxId}`)
    const mintTxHash = await waitForTransaction(mintTxId).catch((e: Error) => { throw new Error(`[step5-receiveMessage] ${e.message}`) })
    console.log(`[cctp/eurc] mint confirmed: ${mintTxHash}`)

    return { burnTxHash, mintTxHash }

  } else {
    // ── USDC: standard CCTP V2 7-arg + tx-hash attestation ────────────────────
    const burnToken  = srcMeta.usdcAddress
    const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })

    const { feeAmount, totalToApprove, finalityThreshold } = await getFee(srcMeta.cctpDomain, dstDomain, amountMicro)
    console.log(`[cctp/usdc] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} fee=${feeAmount} threshold=${finalityThreshold}`)

    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: burnToken,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, totalToApprove] }),
    })
    await waitForTransaction(approveTxId).catch((e: Error) => { throw new Error(`[step1-approve] ${e.message}`) })

    const burnTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: srcMeta.tokenMessengerV2,
      callData:        encodeFunctionData({ abi: [DEPOSIT_FOR_BURN_V2_ABI], functionName: 'depositForBurn', args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, feeAmount, finalityThreshold] }),
    })
    const burnTxHash = await waitForTransaction(burnTxId).catch((e: Error) => { throw new Error(`[step2-depositForBurn] ${e.message}`) })
    console.log(`[cctp/usdc] burn confirmed: ${burnTxHash}`)

    const { message, attestation } = await pollAttestationByTxHash(srcMeta.cctpDomain, burnTxHash)

    const mintTxId = await executeContractCall({
      walletId:        receiverWalletId,
      contractAddress: destTransmitter,
      callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
    })
    const mintTxHash = await waitForTransaction(mintTxId).catch((e: Error) => { throw new Error(`[step4-receiveMessage] ${e.message}`) })
    console.log(`[cctp/usdc] mint confirmed: ${mintTxHash}`)

    return { burnTxHash, mintTxHash }
  }
}
