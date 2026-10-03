import { NextResponse } from 'next/server'
import { createAppServerKit } from '@circle-fin/app-kit/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const server = createAppServerKit({
  onramp: {
    apiKey:         process.env.CIRCLE_API_KEY!,
    referrerDomain: process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '').split('/')[0] ?? 'localhost:3000',
  },
})

export async function POST() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const session = await server.onramp.createSession({
    appUserId:          user.id,
    destinationAddress: wallet.walletAddress,
  })

  return NextResponse.json(session)
}
