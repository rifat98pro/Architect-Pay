'use server'

import { encodeFunctionData, keccak256, pad } from 'viem'
import { executeContractCall, waitForTransaction } from '@/lib/circle'
import { SOURCE_CHAIN_META, ARC_TESTNET_CONFIG, type CctpSourceChain } from '@/lib/cctp-chains'

const IRIS_API = 'https://iris-api-sandbox.circle.com'

// MessageSent(bytes) event topic
const MESSAGE_SENT_TOPIC = '0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0'

const APPROVE_ABI = {
  type:             'function' as const,
  name:             'approve',
  stateMutability:  'nonpayable' as const,
  inputs:           [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs:          [{ name: '', type: 'bool' }],
}

// USDC path: original CCTP V2 extended signature (was working)
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

// EURC path: 4-arg version per Arc CCTP docs (no fee params)
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

// ── EURC helpers (new, per Arc CCTP docs) ─────────────────────────────────────

async function extractMessageBytes(rpcUrl: string, burnTxHash: string): Promise<string> {
  const LIMIT = 30
  const DELAY = 3_000

  for (let i = 0; i < LIMIT; i++) {
    try {
      const res  = await fetch(rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [burnTxHash], id: 1 }),
      })
      const data = await res.json() as { result?: { logs?: Array<{ topics: string[]; data: string }> } }
      const log  = (data.result?.logs ?? []).find(
        (l) => l.topics[0]?.toLowerCase() === MESSAGE_SENT_TOPIC,
      )
      if (log?.data) {
        // ABI-encoded bytes: 32-byte offset + 32-byte length + data
        const hex    = log.data.startsWith('0x') ? log.data.slice(2) : log.data
        const length = parseInt(hex.slice(64, 128), 16)
        return '0x' + hex.slice(128, 128 + length * 2)
      }
    } catch { /* RPC blip */ }
    await new Promise((r) => setTimeout(r, DELAY))
  }
  throw new Error('MessageSent event not found in burn tx receipt after 90 s')
}

async function pollAttestationByMsgHash(messageBytes: string): Promise<string> {
  const messageHash = keccak256(messageBytes as `0x${string}`)
  const url   = `${IRIS_API}/v2/attestations/${messageHash}`
  const LIMIT = 120
  const DELAY = 5_000

  for (let i = 0; i < LIMIT; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json() as { status: string; attestation?: string }
        if (data.status === 'complete' && data.attestation) return data.attestation
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

  if (token === 'EURC') {
    // ── EURC: 4-arg depositForBurn + message-hash attestation (Arc docs) ────

    // Step 1: approve
    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: burnToken,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, amountMicro] }),
    })
    await waitForTransaction(approveTxId)
    console.log(`[cctp/eurc] approve confirmed on ${sourceChain}`)

    // Step 2: depositForBurn (4-arg)
    const burnTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: srcMeta.tokenMessengerV2,
      callData:        encodeFunctionData({ abi: [DEPOSIT_FOR_BURN_ABI], functionName: 'depositForBurn', args: [amountMicro, dstDomain, recipient32, burnToken] }),
    })
    const burnTxHash = await waitForTransaction(burnTxId)
    console.log(`[cctp/eurc] burn confirmed: ${burnTxHash}`)

    // Step 3: extract MessageSent bytes → attestation by message hash
    const messageBytes = await extractMessageBytes(srcMeta.rpcUrl, burnTxHash)
    const attestation  = await pollAttestationByMsgHash(messageBytes)

    // Step 4: receiveMessage
    const mintTxId = await executeContractCall({
      walletId:        receiverWalletId,
      contractAddress: destTransmitter,
      callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [messageBytes as `0x${string}`, attestation as `0x${string}`] }),
    })
    const mintTxHash = await waitForTransaction(mintTxId)
    console.log(`[cctp/eurc] mint confirmed: ${mintTxHash}`)

    return { burnTxHash, mintTxHash }

  } else {
    // ── USDC: original 7-arg + tx-hash attestation (was working, unchanged) ─

    const { feeAmount, totalToApprove, finalityThreshold } = await getFee(srcMeta.cctpDomain, dstDomain, amountMicro)
    console.log(`[cctp/usdc] ${sourceChain} → ${destChain ?? 'ARC-TESTNET'} fee: ${feeAmount} micro`)

    // Step 1: approve
    const approveTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: burnToken,
      callData:        encodeFunctionData({ abi: [APPROVE_ABI], functionName: 'approve', args: [srcMeta.tokenMessengerV2, totalToApprove] }),
    })
    await waitForTransaction(approveTxId)

    // Step 2: depositForBurn (7-arg CCTP V2)
    const burnTxId = await executeContractCall({
      walletId:        sourceWalletId,
      contractAddress: srcMeta.tokenMessengerV2,
      callData:        encodeFunctionData({ abi: [DEPOSIT_FOR_BURN_V2_ABI], functionName: 'depositForBurn', args: [amountMicro, dstDomain, recipient32, burnToken, zeroCaller, feeAmount, finalityThreshold] }),
    })
    const burnTxHash = await waitForTransaction(burnTxId)
    console.log(`[cctp/usdc] burn confirmed: ${burnTxHash}`)

    // Step 3: poll attestation by tx hash
    const { message, attestation } = await pollAttestationByTxHash(srcMeta.cctpDomain, burnTxHash)

    // Step 4: receiveMessage
    const mintTxId = await executeContractCall({
      walletId:        receiverWalletId,
      contractAddress: destTransmitter,
      callData:        encodeFunctionData({ abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage', args: [message as `0x${string}`, attestation as `0x${string}`] }),
    })
    const mintTxHash = await waitForTransaction(mintTxId)
    console.log(`[cctp/usdc] mint confirmed: ${mintTxHash}`)

    return { burnTxHash, mintTxHash }
  }
}
