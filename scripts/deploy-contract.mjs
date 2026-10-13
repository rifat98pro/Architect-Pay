import 'dotenv/config'
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const CIRCLE_API_KEY       = process.env.CIRCLE_API_KEY
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET
const WALLET_ID            = process.env.DEPLOYER_WALLET_ID
const WALLET_ADDRESS       = process.env.DEPLOYER_WALLET_ADDRESS

if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET || !WALLET_ID || !WALLET_ADDRESS) {
  console.error('Set CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, DEPLOYER_WALLET_ID and DEPLOYER_WALLET_ADDRESS in your environment')
  process.exit(1)
}

const contractSdk = initiateSmartContractPlatformClient({
  apiKey:       CIRCLE_API_KEY,
  entitySecret: CIRCLE_ENTITY_SECRET,
})

console.log('Deploying ArchitectPay ERC-20 contract on Arc Testnet...')

const response = await contractSdk.deployContractTemplate({
  id:         'a1b74add-23e0-4712-88d1-6b3009e85a86', // ERC-20 template
  blockchain: 'ARC-TESTNET',
  name:       'ArchitectPayContract',
  walletId:   WALLET_ID,
  templateParameters: {
    name:                 'ArchitectPay',
    symbol:               'APY',
    defaultAdmin:         WALLET_ADDRESS,
    primarySaleRecipient: WALLET_ADDRESS,
  },
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
})

console.log('\nDeployment initiated:')
console.log(JSON.stringify(response.data, null, 2))

const contractId   = response.data?.contractIds?.[0]
const transactionId = response.data?.transactionId

if (!contractId || !transactionId) { console.error('No contractId/transactionId returned'); process.exit(1) }

// Wait for confirmation
console.log('\nWaiting for confirmation...')
const walletSdk = initiateDeveloperControlledWalletsClient({
  apiKey:       CIRCLE_API_KEY,
  entitySecret: CIRCLE_ENTITY_SECRET,
})

for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const tx = await walletSdk.getTransaction({ id: transactionId })
  const state = tx.data?.transaction?.state
  const contractAddress = tx.data?.transaction?.contractAddress
  console.log(`[${i * 5}s] State: ${state}`)
  if (state === 'COMPLETE' || state === 'CONFIRMED') {
    console.log('\n✅ Contract deployed!')
    console.log('Contract address:', contractAddress)
    console.log('Contract ID:     ', contractId)
    console.log('ArcScan:         ', `https://testnet.arcscan.app/address/${contractAddress}`)
    process.exit(0)
  }
  if (state === 'FAILED' || state === 'CANCELLED') {
    console.error('Deployment failed:', state)
    process.exit(1)
  }
}
console.error('Timed out waiting for confirmation. Check Circle Console for status.')
