interface TokenLogoProps {
  token: 'USDC' | 'EURC'
  size?: number
  className?: string
}

export default function TokenLogo({ token, size = 20, className = '' }: TokenLogoProps) {
  if (token === 'USDC') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#2775CA"/>
        <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.234-2.193-.703-2.193-1.523 0-.82.61-1.34 1.828-1.34 1.097 0 1.706.39 2.011 1.366a.424.424 0 00.402.293h.915a.414.414 0 00.414-.43c-.243-1.635-1.34-2.852-3.01-3.108V9.4a.44.44 0 00-.44-.44h-.854a.44.44 0 00-.44.44v.817C13.083 10.46 11.73 11.7 11.73 13.49c0 2.01 1.22 2.8 3.78 3.103 1.706.293 2.254.703 2.254 1.64 0 .938-.818 1.585-1.95 1.585-1.523 0-2.07-.645-2.314-1.62a.415.415 0 00-.402-.306h-.96a.414.414 0 00-.414.43c.28 1.756 1.402 2.974 3.21 3.29v.84c0 .244.196.44.44.44h.854c.244 0 .44-.196.44-.44v-.83c2.01-.365 3.354-1.646 3.354-3.498z" fill="white"/>
      </svg>
    )
  }

  // EURC
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="16" r="16" fill="#2775CA"/>
      <path d="M19.5 11.5a5.5 5.5 0 0 0-9.086 2H9a.5.5 0 0 0 0 1h1.172A5.52 5.52 0 0 0 10 16c0 .511.069 1.006.197 1.5H9a.5.5 0 0 0 0 1h1.448A5.5 5.5 0 0 0 19.5 20.5a.5.5 0 0 0 0-1 4.5 4.5 0 0 1-4.296-3H18a.5.5 0 0 0 0-1h-3.1A4.52 4.52 0 0 1 14.9 16a4.52 4.52 0 0 1 .305-1.5H18a.5.5 0 0 0 0-1h-2.87A4.5 4.5 0 0 1 19.5 12.5a.5.5 0 0 0 0-1z" fill="white"/>
    </svg>
  )
}
