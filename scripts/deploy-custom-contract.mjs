import 'dotenv/config'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { CircleSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const solc      = require('solc')

const CIRCLE_API_KEY       = process.env.CIRCLE_API_KEY
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET
const WALLET_ID            = process.env.DEPLOYER_WALLET_ID

if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET || !WALLET_ID) {
  console.error('Set CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET and DEPLOYER_WALLET_ID in your environment')
  process.exit(1)
}

// Compile
const source = readFileSync(join(__dirname, '../contracts/ArchitectPay.sol'), 'utf8')
const output = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources:  { 'ArchitectPay.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
})))

const errors = (output.errors ?? []).filter(e => e.severity === 'error')
if (errors.length) { console.error(errors); process.exit(1) }

const compiled = output.contracts['ArchitectPay.sol']['ArchitectPay']
const bytecode = '0x' + compiled.evm.bytecode.object
const abiJson  = JSON.stringify(compiled.abi)

console.log('✓ Compiled ArchitectPay.sol')
console.log('Bytecode length:', bytecode.length)

// Deploy via Circle Smart Contract Platform SDK
const sdk = new CircleSmartContractPlatformClient({
  apiKey:       CIRCLE_API_KEY,
  entitySecret: CIRCLE_ENTITY_SECRET,
})

console.log('\nDeploying contract...')
// Circle's identifier for Arc mainnet is 'ARC'; 'ARC-TESTNET' is the testnet.
const BLOCKCHAIN = process.env.DEPLOY_BLOCKCHAIN ?? 'ARC'

const res = await sdk.deployContract({
  name:       'ArchitectPayRegistry',
  walletId:   WALLET_ID,
  blockchain: BLOCKCHAIN,
  bytecode,
  abiJson,
  constructorParameters: [],
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
})

console.log('\nDeploy response:')
console.log(JSON.stringify(res.data, null, 2))

const contractId    = res.data?.contractId ?? res.data?.contractDeployment?.id ?? res.data?.id
const transactionId = res.data?.transactionId ?? res.data?.contractDeployment?.deploymentTransactionId

if (!contractId) { console.error('No contractId returned'); process.exit(1) }

console.log('\nWaiting for confirmation...')

for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const contractRes = await sdk.getContract({ id: contractId })
  const contract    = contractRes.data?.contract
  const status      = contract?.status
  const addr        = contract?.contractAddress
  console.log(`[${i*5}s] Status: ${status}  Address: ${addr ?? 'pending'}`)

  if (status === 'COMPLETE') {
    const explorer = BLOCKCHAIN === 'ARC' ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app'
    console.log('\n✅ ArchitectPay contract deployed!')
    console.log('Contract address:', addr)
    console.log('Contract ID:     ', contractId)
    console.log('ArcScan:', `${explorer}/address/${addr}`)
    console.log('\nNow set CONTRACT_ADDRESS in lib/architect-pay-contract.ts to this address.')
    process.exit(0)
  }
  if (status === 'FAILED') {
    console.error('Deployment failed'); process.exit(1)
  }
}

console.error('Timed out waiting for deployment')
process.exit(1)
