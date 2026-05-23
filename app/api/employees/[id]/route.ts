import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await db.employee.findUnique({ where: { id: params.id } })
  if (!employee || employee.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.employee.update({ where: { id: params.id }, data: { active: false } })

  return NextResponse.json({ ok: true })
}
