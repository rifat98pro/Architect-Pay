import 'dotenv/config'
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'

const client = initiateSmartContractPlatformClient({
  apiKey:       process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
})

const res = await client.getContract({ id: '019e55bb-1b67-7a6a-b023-f81a9907aa83' })
console.log(JSON.stringify(res.data, null, 2))
