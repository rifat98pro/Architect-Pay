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
async function getFee(srcDomain: number, dstDomain: number, amountMicro: bigint): Promise<{
  feeAmount:          bigint
  totalToApprove:     bigint
  finalityThreshold:  number
}> {
  const url = `${IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`
  const res  = await fetch(url)
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
  arcWalletId,
  recipientAddress,
  amount,
}: {
  sourceChain:      CctpSourceChain
  sourceWalletId:   string   // Circle wallet ID on the source chain
  arcWalletId:      string   // Circle wallet ID on Arc Testnet (for receiveMessage)
  recipientAddress: string   // Where USDC should land on Arc Testnet
  amount:           string   // Human-readable e.g. "10.50"
}): Promise<{ burnTxHash: string; mintTxHash: string }> {
  const chain       = SOURCE_CHAIN_META[sourceChain]
  const amountMicro = toMicroUsdc(amount)
  const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })
  const zeroCaller  = pad('0x0', { size: 32 })

  // Fetch fee from Iris — prefer free standard transfer (finalityThreshold=2000)
  const { feeAmount, totalToApprove, finalityThreshold } = await getFee(
    chain.cctpDomain,
    ARC_TESTNET_CONFIG.cctpDomain,
    amountMicro,
  )
  console.log(`[cctp] fee: ${feeAmount} micro-USDC, threshold: ${finalityThreshold}`)

  // ── Step 1: Approve TokenMessengerV2 to spend USDC (amount + fee) ───────────
  console.log(`[cctp] approve ${amount} USDC on ${sourceChain}`)
  const approveCallData = encodeFunctionData({
    abi: [APPROVE_ABI],
    functionName: 'approve',
    args: [chain.tokenMessengerV2, totalToApprove],
  })
  const approveTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: chain.usdcAddress,
    callData:        approveCallData,
  })
  await waitForTransaction(approveTxId)
  console.log(`[cctp] approve confirmed`)

  // ── Step 2: depositForBurn ───────────────────────────────────────────────────
  console.log(`[cctp] depositForBurn on ${sourceChain}`)
  const burnCallData = encodeFunctionData({
    abi: [DEPOSIT_FOR_BURN_ABI],
    functionName: 'depositForBurn',
    args: [
      amountMicro,
      ARC_TESTNET_CONFIG.cctpDomain,
      recipient32,
      chain.usdcAddress,
      zeroCaller,
      feeAmount,
      finalityThreshold,
    ],
  })
  const burnTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: chain.tokenMessengerV2,
    callData:        burnCallData,
  })
  const burnTxHash = await waitForTransaction(burnTxId)
  console.log(`[cctp] burn confirmed: ${burnTxHash}`)

  // ── Step 3: Poll Iris for attestation ───────────────────────────────────────
  console.log(`[cctp] waiting for attestation...`)
  const { message, attestation } = await pollAttestation(chain.cctpDomain, burnTxHash)
  console.log(`[cctp] attestation ready`)

  // ── Step 4: receiveMessage on Arc Testnet ────────────────────────────────────
  console.log(`[cctp] receiveMessage on Arc Testnet`)
  const mintCallData = encodeFunctionData({
    abi: [RECEIVE_MESSAGE_ABI],
    functionName: 'receiveMessage',
    args: [message as `0x${string}`, attestation as `0x${string}`],
  })
  const mintTxId = await executeContractCall({
    walletId:        arcWalletId,
    contractAddress: ARC_TESTNET_CONFIG.messageTransmitterV2,
    callData:        mintCallData,
  })
  const mintTxHash = await waitForTransaction(mintTxId)
  console.log(`[cctp] mint confirmed: ${mintTxHash}`)

  return { burnTxHash, mintTxHash }
}
