import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
  if (!wallet) return NextResponse.json({ received: [] })

  const received = await db.payment.findMany({
    where: {
      recipientAddress: { equals: wallet.walletAddress, mode: 'insensitive' },
      status:           'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
    include: {
      sender: {
        select: { username: true, displayName: true, name: true, image: true },
      },
    },
  })

  return NextResponse.json({ received })
}
