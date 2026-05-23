// Exact string identifiers from the Arc SDK Blockchain enum
export const SUPPORTED_DEPOSIT_CHAINS = [
  'Base_Sepolia',
  'Arbitrum_Sepolia',
  'Ethereum_Sepolia',
  'Polygon_Amoy_Testnet',
] as const

export type DepositChain = (typeof SUPPORTED_DEPOSIT_CHAINS)[number]
