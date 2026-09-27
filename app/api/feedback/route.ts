import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  category: z.enum(['general', 'feature', 'other']).default('general'),
  message:  z.string().min(10).max(2000),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const feedback = await db.feedback.create({
    data: { userId: user.id, ...parsed.data },
  })

  return NextResponse.json({ success: true, id: feedback.id })
}
