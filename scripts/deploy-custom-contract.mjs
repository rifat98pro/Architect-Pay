import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { CircleSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const solc      = require('solc')

const CIRCLE_API_KEY       = 'TEST_API_KEY:ef60fd64b6f1a2737ba2a2ba6952ea9c:a9e385105d3dddba25cb61733b2418be'
const CIRCLE_ENTITY_SECRET = '9bcaf434c428c1ca4d1b1a742cdcf0877d2ee6a5ec40b2c014e1654fcc951004'
const WALLET_ID            = 'cfdc79f4-9f3a-5357-ad36-684df0e41cc8'

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
const res = await sdk.deployContract({
  name:       'ArchitectPayRegistry',
  walletId:   WALLET_ID,
  blockchain: 'ARC-TESTNET',
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
    console.log('\n✅ ArchitectPay contract deployed!')
    console.log('Contract address:', addr)
    console.log('Contract ID:     ', contractId)
    console.log('ArcScan:', `https://testnet.arcscan.app/address/${addr}`)
    process.exit(0)
  }
  if (status === 'FAILED') {
    console.error('Deployment failed'); process.exit(1)
  }
}

console.error('Timed out waiting for deployment')
process.exit(1)
