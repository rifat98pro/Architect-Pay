import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title:       z.string().min(3).max(150),
  description: z.string().min(10).max(3000),
  steps:       z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const report = await db.bugReport.create({
    data: { userId: user.id, ...parsed.data },
  })

  return NextResponse.json({ success: true, id: report.id })
}
