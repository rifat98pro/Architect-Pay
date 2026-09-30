interface Props { chain: string; size?: number }

function Wrap({ size, bg, children }: { size: number; bg: string; children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <circle cx="16" cy="16" r="16" fill={bg} />
      {children}
    </svg>
  )
}

export default function ChainLogo({ chain, size = 20 }: Props) {
  switch (chain) {

    /* ── Ethereum ── */
    case 'ETH-SEPOLIA':
      return (
        <Wrap size={size} bg="#627EEA">
          {/* Classic ETH diamond prism — 6 facets with opacity levels */}
          <path d="M16 5L8 17.5L16 14V5Z"               fill="white" />
          <path d="M16 5L24 17.5L16 14V5Z"               fill="white" fillOpacity="0.6" />
          <path d="M8 17.5L16 20.5V14L8 17.5Z"           fill="white" fillOpacity="0.6" />
          <path d="M24 17.5L16 20.5V14L24 17.5Z"         fill="white" fillOpacity="0.2" />
          <path d="M8 17.5L16 27V20.5L8 17.5Z"           fill="white" fillOpacity="0.6" />
          <path d="M24 17.5L16 27V20.5L24 17.5Z"         fill="white" fillOpacity="0.2" />
        </Wrap>
      )

    /* ── Base ── */
    case 'BASE-SEPOLIA':
      return (
        <Wrap size={size} bg="#0052FF">
          {/* Vertical stroke of "b" */}
          <rect x="8" y="5.5" width="4" height="21" rx="2" fill="white" />
          {/* Bowl of "b" — arc from top of bowl to bottom, sweeping right */}
          <path d="M12 13A7 6.5 0 1 1 12 26Z" fill="white" />
        </Wrap>
      )

    /* ── Arbitrum ── */
    case 'ARB-SEPOLIA':
      return (
        <Wrap size={size} bg="#213147">
          {/* Outer "A" body */}
          <path d="M16 6L6.5 26H11L13.5 20H18.5L21 26H25.5L16 6Z" fill="white" />
          {/* Cut out inner triangle to hollow the A */}
          <path d="M16 10L11 23.5H21L16 10Z" fill="#213147" />
          {/* Restore crossbar area */}
          <rect x="13" y="18.5" width="6" height="2.5" fill="white" />
          {/* Blue accent line */}
          <path d="M13.5 21H18.5" stroke="#12AAFF" strokeWidth="1" />
        </Wrap>
      )

    /* ── Polygon / MATIC ── */
    case 'MATIC-AMOY':
      return (
        <Wrap size={size} bg="#8247E5">
          {/* Three connected rhombuses forming the MATIC mark */}
          <path
            d="M20 11.5L16 9L12 11.5V16.5L16 19L20 16.5V11.5Z"
            fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round"
          />
          <path d="M12 11.5L7.5 14L12 16.5"  stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M20 11.5L24.5 14L20 16.5" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 16.5L16 19L20 16.5"   stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M7.5 14L12 16.5V21.5L7.5 19V14Z"   fill="white" fillOpacity="0.25" />
          <path d="M24.5 14L20 16.5V21.5L24.5 19V14Z" fill="white" fillOpacity="0.25" />
          <path d="M12 21.5L16 24L20 21.5L16 19L12 21.5Z" fill="white" fillOpacity="0.5" />
        </Wrap>
      )

    /* ── Arc Testnet (custom) ── */
    case 'ARC-TESTNET':
    default:
      return (
        <Wrap size={size} bg="#2AABAB">
          {/* Stylised arc "A" */}
          <path d="M16 6L25.5 26H21L19 21H13L11 26H6.5L16 6Z" fill="white" />
          {/* Inner hollow to form the A */}
          <path d="M16 10.5L11.5 22.5H20.5L16 10.5Z" fill="#2AABAB" />
          {/* Crossbar */}
          <rect x="13" y="18" width="6" height="2.5" fill="white" />
        </Wrap>
      )
  }
}
