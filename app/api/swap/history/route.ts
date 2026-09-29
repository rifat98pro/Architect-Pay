import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const swaps = await db.swapHistory.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    100,
  })

  return NextResponse.json({ swaps })
}
