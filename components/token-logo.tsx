import Image from 'next/image'

interface TokenLogoProps {
  token: 'USDC' | 'EURC'
  size?: number
  className?: string
}

export default function TokenLogo({ token, size = 20, className = '' }: TokenLogoProps) {
  if (token === 'USDC') {
    return (
      <Image
        src="/usdc.webp"
        alt="USDC"
        width={size}
        height={size}
        className={`rounded-full ${className}`}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
      />
    )
  }

  // EURC PNG has a white rectangular background — clip it with a circular container
  return (
    <span
      className={className}
      style={{
        display:      'inline-flex',
        width:        size,
        height:       size,
        borderRadius: '50%',
        overflow:     'hidden',
        background:   '#2775CA',
        flexShrink:   0,
        verticalAlign:'middle',
      }}
    >
      <Image
        src="/eurc.png"
        alt="EURC"
        width={size}
        height={size}
        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      />
    </span>
  )
}
