import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payments = await db.payment.findMany({
    where:   { senderId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
  })

  return NextResponse.json({ payments })
}
