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

// USDC: CCTP V2 extended 7-arg signature (working)
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

// EURC: Arc docs show 4-arg signature — 7-arg causes ESTIMATION_ERROR for EURC
const DEPOSIT_FOR_BURN_ABI = {
  type:            'function' as const,
  name:            'depositForBurn',
  stateMutability: 'nonpayable' as const,
  inputs: [
    { name: 'amount',            type: 'uint256' },
    { name: 'destinationDomain', type: 'uint32'  },
    { name: 'mintRecipient',     type: 'bytes32' },
    { name: 'burnToken',         type: 'address' },
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

// ── USDC helpers (original, untouched) ────────────────────────────────────────

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
  const srcMeta   = SOURCE_CHAIN_META[sourceChain]
  const dstMeta   = destChain ? SOURCE_CHAIN_META[destChain] : null
  const dstDomain = dstMeta ? dstMeta.cctpDomain : ARC_TESTNET_CONFIG.cctpDomain
  const receiverWalletId  = destWalletId ?? arcWalletId
  const destTransmitter   = dstMeta ? dstMeta.messageTransmitterV2 : ARC_TESTNET_CONFIG.messageTransmitterV2

  const burnToken = token === 'EURC' ? srcMeta.eurcAddress : srcMeta.usdcAddress
  if (!burnToken) throw new Error(`${token} is not supported on ${sourceChain}`)

  const amountMicro = toMicroUsdc(amount)
  const recipient32 = pad(recipientAddress as `0x${string}`, { size: 32 })
  const zeroCaller  = pad('0x0', { size: 32 })

  // Step 1: approve
  // EURC: approve exact amount (no relayer fee). USDC: approve amount + fee.
  let totalToApprove: bigint
  let burnCallData: `0x${string}`

  if (token === 'EURC') {
    totalToApprove = amountMicro
    burnCallData = encodeFunctionData({
      abi: [DEPOSIT_FOR_BURN_ABI],
      functionName: 'depositForBurn',
      args: [amountMicro, dstDomain, recipient32, burnToken],
    })
    console.log(`[cctp/eurc] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} 4-arg depositForBurn`)
  } else {
    const { feeAmount, totalToApprove: usdcApprove, finalityThreshold } = await getFee(srcMeta.cctpDomain, dstDomain, amountMicro)
    totalToApprove = usdcApprove
    burnCallData = encodeFunctionData({
      abi: [DEPOSIT_FOR_BURN_V2_ABI],
      functionName: 'depositForBurn',
      args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, feeAmount, finalityThreshold],
    })
    console.log(`[cctp/usdc] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} fee=${feeAmount} threshold=${finalityThreshold}`)
  }

  const approveTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: burnToken,
    callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, totalToApprove] }),
  })
  console.log(`[cctp/${token.toLowerCase()}] approve tx: ${approveTxId}`)
  await waitForTransaction(approveTxId).catch((e: Error) => {
    throw new Error(`[step1-approve] ${e.message}`)
  })
  console.log(`[cctp/${token.toLowerCase()}] approve confirmed on ${sourceChain}`)

  // Step 2: depositForBurn
  const burnTxId = await executeContractCall({
    walletId:        sourceWalletId,
    contractAddress: srcMeta.tokenMessengerV2,
    callData:        burnCallData,
  })
  console.log(`[cctp/${token.toLowerCase()}] burn tx: ${burnTxId}`)
  const burnTxHash = await waitForTransaction(burnTxId).catch((e: Error) => {
    throw new Error(`[step2-depositForBurn] ${e.message}`)
  })
  console.log(`[cctp/${token.toLowerCase()}] burn confirmed: ${burnTxHash}`)

  // Step 3: poll attestation by tx hash
  const { message, attestation } = await pollAttestationByTxHash(srcMeta.cctpDomain, burnTxHash)

  // Step 4: receiveMessage
  const mintTxId = await executeContractCall({
    walletId:        receiverWalletId,
    contractAddress: destTransmitter,
    callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
  })
  console.log(`[cctp/${token.toLowerCase()}] mint tx: ${mintTxId}`)
  const mintTxHash = await waitForTransaction(mintTxId).catch((e: Error) => {
    throw new Error(`[step4-receiveMessage] ${e.message}`)
  })
  console.log(`[cctp/${token.toLowerCase()}] mint confirmed: ${mintTxHash}`)

  return { burnTxHash, mintTxHash }
}
