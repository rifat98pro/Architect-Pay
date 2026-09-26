import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({ name: z.string().min(1).max(100) })

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businesses = await db.business.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, name: true, createdAt: true },
  })

  return NextResponse.json({ businesses })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const business = await db.business.create({
    data: { userId: user.id, name: parsed.data.name },
  })

  return NextResponse.json({ business }, { status: 201 })
}
