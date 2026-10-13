import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lookupLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(lookupLimiter, getIP(request))
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('username')?.trim().replace(/^@/, '').toLowerCase()
  if (!raw) return NextResponse.json({ error: 'username required' }, { status: 400 })

  const user = await db.user.findUnique({
    where: { username: raw },
    include: { wallet: { select: { walletAddress: true } } },
  })

  if (!user || !user.wallet) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  return NextResponse.json({
    found:         true,
    displayName:   user.displayName ?? user.name ?? raw,
    walletAddress: user.wallet.walletAddress,
    image:         user.image ?? null,
  })
}
