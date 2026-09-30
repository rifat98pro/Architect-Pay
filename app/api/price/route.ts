import { NextResponse } from 'next/server'

export const revalidate = 60 // cache 60 s

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=euro-coin&vs_currencies=usd',
      { next: { revalidate: 60 } }
    )
    if (!res.ok) throw new Error('CoinGecko error')
    const data = await res.json()
    const rate = data?.['euro-coin']?.usd ?? 1.1
    return NextResponse.json({ eurcUsd: rate })
  } catch {
    // Fallback to a reasonable EUR/USD estimate
    return NextResponse.json({ eurcUsd: 1.1 })
  }
}
