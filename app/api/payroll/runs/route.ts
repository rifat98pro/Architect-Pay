import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runs = await db.payrollRun.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    20,
    include: {
      entries: {
        include: { employee: { select: { name: true, walletAddress: true } } },
      },
    },
  })

  return NextResponse.json({ runs })
}
