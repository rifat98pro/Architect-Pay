/**
 * One-off recovery: claim a CCTPx transfer whose burn succeeded but whose mint was
 * never submitted.
 *
 * CCTPx quoted without a FORWARD request is a "direct mint" — nothing relays it for
 * you, so if the burn is recorded nowhere the funds sit claimable but unclaimed.
 *
 * Run with PRODUCTION Circle credentials:
 *   CIRCLE_API_KEY=... CIRCLE_ENTITY_SECRET=... node scripts/claim-stranded-cctpx.mjs
 *
 * Reads first and prints what it will do; pass --execute to actually submit.
 */
import 'dotenv/config'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData } from 'viem'

const BURN_TX     = process.env.BURN_TX     ?? '0x046064efb16f25d299f321773a3b47a5b827f508896eae4751f4320ad56c7c96'
const SRC_DOMAIN  = process.env.SRC_DOMAIN  ?? '6'   // Base
const ARC_WALLET  = process.env.ARC_WALLET_ID        // Circle wallet id for Arc
const TRANSMITTER = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64' // MessageTransmitterV2 on Arc
const EXECUTE     = process.argv.includes('--execute')

const RECEIVE_MESSAGE_ABI = {
  type: 'function', name: 'receiveMessage', stateMutability: 'nonpayable',
  inputs: [{ name: 'message', type: 'bytes' }, { name: 'attestation', type: 'bytes' }],
  outputs: [],
}

const res  = await fetch(`https://iris-api.circle.com/v2/messages/${SRC_DOMAIN}?transactionHash=${BURN_TX}`)
const msg  = (await res.json())?.messages?.[0]
if (!msg)                       { console.error('No message found for that burn tx'); process.exit(1) }
if (msg.status !== 'complete')  { console.error(`Attestation not ready yet (status: ${msg.status})`); process.exit(1) }

console.log('burn tx      :', BURN_TX)
console.log('status       :', msg.status)
console.log('dest domain  :', msg.decodedMessage?.destinationDomain, '(26 = Arc)')
console.log('will submit  : receiveMessage ->', TRANSMITTER)

if (!EXECUTE) {
  console.log('\nDry run. Re-run with --execute to submit the mint.')
  process.exit(0)
}
if (!ARC_WALLET) { console.error('\nSet ARC_WALLET_ID to your Arc Circle wallet id'); process.exit(1) }

const client = initiateDeveloperControlledWalletsClient({
  apiKey:       process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
})

const callData = encodeFunctionData({
  abi: [RECEIVE_MESSAGE_ABI], functionName: 'receiveMessage',
  args: [msg.message, msg.attestation],
})

const tx = await client.createContractExecutionTransaction({
  walletId:        ARC_WALLET,
  contractAddress: TRANSMITTER,
  callData,
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
})

const id = tx.data?.id ?? tx.data?.transaction?.id
console.log('\nsubmitted. Circle tx id:', id)
console.log('Check your Arc EURC balance in a minute or two.')
