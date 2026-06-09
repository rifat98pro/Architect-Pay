import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { createPublicClient, http, parseAbiItem, keccak256, encodeFunctionData } from 'viem'
import { executeContractCall, waitForTransaction } from '@/lib/circle'

export const maxDuration = 300

const ETH_SEPOLIA_RPC          = 'https://ethereum-sepolia-rpc.publicnode.com'
const ETH_SEPOLIA_TRANSMITTER  = '0xe737e5cebeeba77efe34d4aa090756590b1ce275' as `0x${string}`
const ARC_TRANSMITTER          = '0xe737e5cebeeba77efe34d4aa090756590b1ce275' as `0x${string}`
const ARC_TESTNET_DOMAIN       = 26
const ETH_SEPOLIA_DOMAIN       = 0
const ATTESTATION_API          = 'https://iris-api-sandbox.circle.com/v1/messages'

const MESSAGE_SENT_ABI  = parseAbiItem('event MessageSent(bytes message)')
const RECEIVE_MSG_ABI   = [{
  name: 'receiveMessage',
  type: 'function',
  inputs: [
    { name: 'message',     type: 'bytes' },
    { name: 'attestation', type: 'bytes' },
  ],
  outputs: [{ type: 'bool' }],
  stateMutability: 'nonpayable',
}] as const

function getRecipient(messageHex: string): string {
  // CCTP message layout (hex offsets, no 0x prefix):
  // 0-7:   version (4 bytes)
  // 8-15:  sourceDomain (4 bytes)
  // 16-23: destinationDomain (4 bytes)
  // 24-39: nonce (8 bytes)
  // 40-103: sender (32 bytes)
  // 104-167: recipient (32 bytes) — address is last 40 chars (right-aligned)
  const hex = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex
  return '0x' + hex.slice(128, 168) // last 20 bytes of the 32-byte recipient field
}

function getDestDomain(messageHex: string): number {
  const hex = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex
  return parseInt(hex.slice(16, 24), 16)
}

export async function POST() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const walletAddress = wallet.walletAddress.toLowerCase()

  // Scan ETH Sepolia MessageTransmitter for MessageSent events targeting Arc Testnet
  // where the recipient is this user's wallet
  const ethClient = createPublicClient({
    transport: http(ETH_SEPOLIA_RPC),
  })

  const latestBlock = await ethClient.getBlockNumber()
  const fromBlock   = latestBlock > BigInt(50000) ? latestBlock - BigInt(50000) : BigInt(0)

  const logs = await ethClient.getLogs({
    address:   ETH_SEPOLIA_TRANSMITTER,
    event:     MESSAGE_SENT_ABI,
    fromBlock,
    toBlock:   'latest',
  })

  const pending: string[] = []

  for (const log of logs) {
    const msgHex = log.args.message as `0x${string}`
    if (
      getDestDomain(msgHex) === ARC_TESTNET_DOMAIN &&
      getRecipient(msgHex).toLowerCase() === walletAddress
    ) {
      pending.push(log.transactionHash)
    }
  }

  if (pending.length === 0) {
    return NextResponse.json({ message: 'No pending CCTP transfers found from ETH Sepolia to Arc Testnet for your wallet.' })
  }

  const results: { txHash: string; status: string; arcTxHash?: string }[] = []

  for (const txHash of pending) {
    // Check attestation status
    const attResp = await fetch(`${ATTESTATION_API}/${ETH_SEPOLIA_DOMAIN}/${txHash}`)
    if (!attResp.ok) {
      results.push({ txHash, status: 'attestation_api_error' })
      continue
    }

    const attData = await attResp.json() as {
      messages?: { attestation: string; message: string; status: string }[]
    }

    const msg = attData.messages?.[0]
    if (!msg || msg.status !== 'complete') {
      results.push({ txHash, status: `attestation_pending (${msg?.status ?? 'unknown'})` })
      continue
    }

    // Submit receiveMessage on Arc Testnet using the user's Arc wallet
    try {
      const callData = encodeFunctionData({
        abi:          RECEIVE_MSG_ABI,
        functionName: 'receiveMessage',
        args:         [msg.message as `0x${string}`, msg.attestation as `0x${string}`],
      })

      const circleTxId = await executeContractCall({
        walletId:        wallet.circleWalletId,
        contractAddress: ARC_TRANSMITTER,
        callData,
      })

      const arcTxHash = await waitForTransaction(circleTxId)
      results.push({ txHash, status: 'recovered', arcTxHash })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'unknown error'
      results.push({ txHash, status: `submit_failed: ${errMsg}` })
    }
  }

  return NextResponse.json({ results })
}
