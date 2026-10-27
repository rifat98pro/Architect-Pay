import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payments = await db.payment.findMany({
    where:   { senderId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
  })

  // Augment with recipient user profile if recipient is an Architect Pay user
  const addresses = payments.map((p) => p.recipientAddress)
  const wallets = await db.wallet.findMany({
    where:   { walletAddress: { in: addresses } },
    include: { user: { select: { username: true, displayName: true, name: true, image: true } } },
  })
  const walletMap = new Map(wallets.map((w) => [w.walletAddress.toLowerCase(), w]))

  const augmented = payments.map((p) => {
    const w = walletMap.get(p.recipientAddress.toLowerCase())
    return {
      ...p,
      recipientUser: w ? {
        username:    w.user.username,
        displayName: w.user.displayName ?? w.user.name ?? w.user.username,
        image:       w.user.image,
      } : null,
      isInternal: !!w,
    }
  })

  return NextResponse.json({ payments: augmented })
}
