import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; empId: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: bizId, empId } = await params

  const employee = await db.employee.findUnique({ where: { id: empId } })
  if (!employee || employee.userId !== user.id || employee.businessId !== bizId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get('avatar') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
  }

  const bytes   = await file.arrayBuffer()
  const base64  = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  const updated = await db.employee.update({ where: { id: empId }, data: { avatarUrl: dataUrl } })
  return NextResponse.json({ employee: updated })
}
