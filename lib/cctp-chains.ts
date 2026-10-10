export const CCTP_SOURCE_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA', 'ARB-SEPOLIA', 'MATIC-AMOY', 'AVAX-FUJI', 'OP-SEPOLIA'] as const
export type CctpSourceChain = (typeof CCTP_SOURCE_CHAINS)[number]
export type AnyChain = CctpSourceChain

// Chains that support EURC CCTP bridging
export const EURC_CCTP_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA'] as const
export type EurcCctpChain = (typeof EURC_CCTP_CHAINS)[number]

// CrossChainTokenService (CCTPx) — mainnet address on Arc
export const CCTS_ADDRESS = '0x431871229103b780868f8C6BB820cd16ECf942BC' as const
// EURC token ID in the CCTPx registry (mainnet) — verify from docs.arc.io/arc/references/contract-addresses
export const EURC_CCTPX_TOKEN_ID = '0x6ca9e29fa53becc29becaf4a90b9ca7a995ad4d2234880da13ca38c657fb241c' as const

// Maps our internal chain key → Circle SDK blockchain name (mainnet)
export const CIRCLE_BLOCKCHAIN: Record<CctpSourceChain, string> = {
  'ARC-TESTNET':  'ARC',
  'ETH-SEPOLIA':  'ETH',
  'BASE-SEPOLIA': 'BASE',
  'ARB-SEPOLIA':  'ARB',
  'MATIC-AMOY':   'MATIC',
  'AVAX-FUJI':    'AVAX',
  'OP-SEPOLIA':   'OP',
}

export const SOURCE_CHAIN_META: Record<CctpSourceChain, {
  label:                string
  cctpDomain:           number
  rpcUrl:               string
  usdcAddress:          `0x${string}`
  eurcAddress?:         `0x${string}`
  eurcTokenManager?:    `0x${string}`
  tokenMessengerV2:     `0x${string}`
  messageTransmitterV2: `0x${string}`
}> = {
  'ARC-TESTNET': {
    label:                'Arc',
    cctpDomain:           26,
    rpcUrl:               'https://rpc.mainnet.arc.io',
    usdcAddress:          '0x3600000000000000000000000000000000000000',
    eurcAddress:          '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    eurcTokenManager:     '0x431871229103b780868f8C6BB820cd16ECf942BC',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'ETH-SEPOLIA': {
    label:                'Ethereum',
    cctpDomain:           0,
    rpcUrl:               'https://ethereum.publicnode.com',
    usdcAddress:          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    eurcAddress:          '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'BASE-SEPOLIA': {
    label:                'Base',
    cctpDomain:           6,
    rpcUrl:               'https://mainnet.base.org',
    usdcAddress:          '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    eurcAddress:          '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'ARB-SEPOLIA': {
    label:                'Arbitrum',
    cctpDomain:           3,
    rpcUrl:               'https://arb1.arbitrum.io/rpc',
    usdcAddress:          '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'MATIC-AMOY': {
    label:                'Polygon',
    cctpDomain:           7,
    rpcUrl:               'https://polygon-rpc.com',
    usdcAddress:          '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'AVAX-FUJI': {
    label:                'Avalanche C-Chain',
    cctpDomain:           1,
    rpcUrl:               'https://api.avax.network/ext/bc/C/rpc',
    usdcAddress:          '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    eurcAddress:          '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
  'OP-SEPOLIA': {
    label:                'Optimism',
    cctpDomain:           2,
    rpcUrl:               'https://mainnet.optimism.io',
    usdcAddress:          '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    tokenMessengerV2:     '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  },
}

// Kept for backward compatibility
export const ARC_TESTNET_CONFIG = SOURCE_CHAIN_META['ARC-TESTNET']

export const ALL_CHAINS: CctpSourceChain[] = [...CCTP_SOURCE_CHAINS]

export const CHAIN_LABEL: Record<CctpSourceChain, string> = {
  'ARC-TESTNET':  'Arc',
  'ETH-SEPOLIA':  'Ethereum',
  'BASE-SEPOLIA': 'Base',
  'ARB-SEPOLIA':  'Arbitrum',
  'MATIC-AMOY':   'Polygon',
  'AVAX-FUJI':    'Avalanche',
  'OP-SEPOLIA':   'Optimism',
}
