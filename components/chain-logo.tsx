interface Props { chain: string; size?: number }

const LOGOS: Record<string, string> = {
  'ARC-TESTNET':  '/chains/arc.svg',
  'ETH-SEPOLIA':  '/chains/eth.svg',
  'BASE-SEPOLIA': '/chains/base.svg',
  'ARB-SEPOLIA':  '/chains/arb.svg',
  'MATIC-AMOY':   '/chains/pol.svg',
}

export default function ChainLogo({ chain, size = 20 }: Props) {
  const src = LOGOS[chain] ?? LOGOS['ARC-TESTNET']
  return (
    <img
      src={src}
      alt={chain}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        objectFit: 'cover',
      }}
    />
  )
}
