// Exact string identifiers from the Arc SDK Blockchain enum (mainnet)
export const SUPPORTED_DEPOSIT_CHAINS = [
  'Base',
  'Arbitrum',
  'Ethereum',
  'Polygon',
] as const

export type DepositChain = (typeof SUPPORTED_DEPOSIT_CHAINS)[number]
