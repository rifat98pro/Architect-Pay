import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const business = await db.business.findUnique({ where: { id } })
  if (!business || business.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
  }

  const bytes  = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  const updated = await db.business.update({ where: { id }, data: { logoUrl: dataUrl } })
  return NextResponse.json({ business: updated })
}
