'use server'

import { encodeFunctionData, pad } from 'viem'
import { executeContractCall, waitForTransaction } from '@/lib/circle'
import { SOURCE_CHAIN_META, ARC_TESTNET_CONFIG, type CctpSourceChain } from '@/lib/cctp-chains'

const IRIS_API = 'https://iris-api-sandbox.circle.com'

const APPROVE_ABI = {
  type:             'function' as const,
  name:             'approve',
  stateMutability:  'nonpayable' as const,
  inputs:           [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs:          [{ name: '', type: 'bool' }],
}

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

/**
 * Fetch the CCTP V2 fee for a given route from the Iris API.
 * Returns { feeAmount, totalToApprove, finalityThreshold }.
 * Prefers standard transfer (free, finalityThreshold=2000) over fast (paid).
 */
async function getFee(srcDomain: number, dstDomain: number, amountMicro: bigint, token: 'USDC' | 'EURC' = 'USDC'): Promise<{
  feeAmount:          bigint
  totalToApprove:     bigint
  finalityThreshold:  number
}> {
  // Try token-specific fee endpoint; EURC may fall back to USDC pricing if not found
  let url = `${IRIS_API}/v2/burn/${token}/fees/${srcDomain}/${dstDomain}`
  let res = await fetch(url)
  if (!res.ok && token === 'EURC') {
    url = `${IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`
    res = await fetch(url)
  }
  if (!res.ok) throw new Error(`Failed to fetch CCTP fee: ${res.status}`)

  const tiers = await res.json() as Array<{ finalityThreshold: number; minimumFee: number }>

  // Prefer fast tier (finalityThreshold=1000, ~2-3 min) even if it has a fee
  const sorted = [...tiers].sort((a, b) => a.finalityThreshold - b.finalityThreshold)
  const tier   = sorted[0] // lowest threshold = fastest

  if (tier.minimumFee === 0) {
    return { feeAmount: BigInt(0), totalToApprove: amountMicro, finalityThreshold: tier.finalityThreshold }
  }

  // minimumFee is a percentage — e.g. 1 means 1%. Use basis points to avoid floats.
  const basisPoints = BigInt(Math.round(tier.minimumFee * 100)) // 1% → 100 bps
  const feeAmount   = (amountMicro * basisPoints) / BigInt(10_000)
  return {
    feeAmount,
    totalToApprove:    amountMicro + feeAmount,
    finalityThreshold: tier.finalityThreshold,
  }
}

async function pollAttestation(srcDomain: number, burnTxHash: string): Promise<{ message: string; attestation: string }> {
  const url = `${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`
  const LIMIT = 120 // 10 minutes max
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
    } catch {
      // network blip — keep polling
    }
    await new Promise((r) => setTimeout(r, DELAY))
  }
  throw new Error('Iris attestation timed out after 10 minutes')
}

/**
 * Cross-chain USDC transfer from a source chain to Arc Testnet via CCTP V2.
 *
 * Flow:
 *   1. approve(TokenMessengerV2, amount) on source chain
 *   2. depositForBurn(...) on source chain  → get txHash
 *   3. Poll Iris API until attestation is ready
 *   4. receiveMessage(message, attestation) on Arc Testnet → USDC minted to recipient
 *
 * All transactions are signed by the user's Circle SCA wallet; Gas Station
 * sponsors fees on each chain.
 */
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
  const srcMeta  = SOURCE_CHAIN_META[sourceChain]
  const dstMeta  = destChain ? SOURCE_CHAIN_META[destChain] : null
  const dstDomain = dstMeta ? dstMeta.cctpDomain : ARC_TESTNET_CONFIG.cctpDomain
  const receiverWalletId = destWalletId ?? arcWalletId

  const burnToken = token === 'EURC' ? srcMeta.eurcAddress : srcMeta.usdcAddress
  if (!burnToken) throw new Error(`${token} is not supported on ${sourceChain}`)

  const amountMicro = toMicroUsdc(amount)
  const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })
  const zeroCaller  = pad('0x0', { size: 32 })

  const { feeAmount, totalToApprove, finalityThreshold } = await getFee(
    srcMeta.cctpDomain,
    dstDomain,
    amountMicro,
    token,
  )
  console.log(`[cctp] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} ${token} fee: ${feeAmount} micro`)

  // Step 1: Approve
  const approveCallData = encodeFunctionData({
    abi: [APPROVE_ABI],
    functionName: 'approve',
    args: [srcMeta.tokenMessengerV2, totalToApprove],
  })
  const approveTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: burnToken,
    callData:        approveCallData,
  })
  await waitForTransaction(approveTxId)

  // Step 2: depositForBurn
  const burnCallData = encodeFunctionData({
    abi: [DEPOSIT_FOR_BURN_ABI],
    functionName: 'depositForBurn',
    args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, feeAmount, finalityThreshold],
  })
  const burnTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: srcMeta.tokenMessengerV2,
    callData:        burnCallData,
  })
  const burnTxHash = await waitForTransaction(burnTxId)
  console.log(`[cctp] burn confirmed: ${burnTxHash}`)

  // Step 3: Poll Iris
  const { message, attestation } = await pollAttestation(srcMeta.cctpDomain, burnTxHash)

  // Step 4: receiveMessage on destination chain
  const mintCallData = encodeFunctionData({
    abi: [RECEIVE_MESSAGE_ABI],
    functionName: 'receiveMessage',
    args: [message as `0x${string}`, attestation as `0x${string}`],
  })

  const destTransmitterAddress = dstMeta
    ? dstMeta.messageTransmitterV2
    : ARC_TESTNET_CONFIG.messageTransmitterV2

  const mintTxId = await executeContractCall({
    walletId:        receiverWalletId,
    contractAddress: destTransmitterAddress,
    callData:        mintCallData,
  })
  const mintTxHash = await waitForTransaction(mintTxId)
  console.log(`[cctp] mint confirmed: ${mintTxHash}`)

  return { burnTxHash, mintTxHash }
}
