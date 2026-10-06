import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const editSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address').optional(),
  salary:        z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0).optional(),
  role:          z.string().max(100).optional(),
  preferredChain: z.string().max(50).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee || employee.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body   = await req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const updated = await db.employee.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ employee: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee || employee.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.employee.update({ where: { id }, data: { active: false } })

  return NextResponse.json({ ok: true })
}
