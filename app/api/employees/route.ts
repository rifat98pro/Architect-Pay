import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name:          z.string().min(1).max(100),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
  salary:        z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
})

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employees = await db.employee.findMany({
    where:   { userId: user.id, active: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ employees })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const employee = await db.employee.create({
    data: { userId: user.id, ...parsed.data },
  })

  return NextResponse.json({ employee }, { status: 201 })
}
