import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'

const client = initiateSmartContractPlatformClient({
  apiKey:       'TEST_API_KEY:ef60fd64b6f1a2737ba2a2ba6952ea9c:a9e385105d3dddba25cb61733b2418be',
  entitySecret: '9bcaf434c428c1ca4d1b1a742cdcf0877d2ee6a5ec40b2c014e1654fcc951004',
})

const res = await client.getContract({ id: '019e55bb-1b67-7a6a-b023-f81a9907aa83' })
console.log(JSON.stringify(res.data, null, 2))
