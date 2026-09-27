export const CCTP_SOURCE_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA', 'ARB-SEPOLIA', 'MATIC-AMOY'] as const
export type CctpSourceChain = (typeof CCTP_SOURCE_CHAINS)[number]
export type AnyChain = CctpSourceChain

export const SOURCE_CHAIN_META: Record<CctpSourceChain, {
  label:                string
  cctpDomain:           number
  usdcAddress:          `0x${string}`
  tokenMessengerV2:     `0x${string}`
  messageTransmitterV2: `0x${string}`
}> = {
  'ARC-TESTNET': {
    label:                'Arc Testnet',
    cctpDomain:           26,
    usdcAddress:          '0x3600000000000000000000000000000000000000',
    tokenMessengerV2:     '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitterV2: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
  },
  'ETH-SEPOLIA': {
    label:                'Ethereum Sepolia',
    cctpDomain:           0,
    usdcAddress:          '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    tokenMessengerV2:     '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitterV2: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
  },
  'BASE-SEPOLIA': {
    label:                'Base Sepolia',
    cctpDomain:           6,
    usdcAddress:          '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessengerV2:     '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitterV2: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
  },
  'ARB-SEPOLIA': {
    label:                'Arbitrum Sepolia',
    cctpDomain:           3,
    usdcAddress:          '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
    tokenMessengerV2:     '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitterV2: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
  },
  'MATIC-AMOY': {
    label:                'Polygon Amoy',
    cctpDomain:           7,
    usdcAddress:          '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',
    tokenMessengerV2:     '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitterV2: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
  },
}

// Kept for backward compatibility — same data as SOURCE_CHAIN_META['ARC-TESTNET']
export const ARC_TESTNET_CONFIG = SOURCE_CHAIN_META['ARC-TESTNET']

export const ALL_CHAINS: CctpSourceChain[] = [...CCTP_SOURCE_CHAINS]

export const CHAIN_LABEL: Record<CctpSourceChain, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
  'ARB-SEPOLIA':  'Arbitrum Sepolia',
  'MATIC-AMOY':   'Polygon Amoy',
}
