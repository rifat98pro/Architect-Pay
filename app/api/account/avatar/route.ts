import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image } = await req.json()
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  }

  // ~1.5MB limit (base64 is ~33% larger than binary)
  if (image.length > 2_100_000) {
    return NextResponse.json({ error: 'Image too large (max 1.5 MB)' }, { status: 400 })
  }

  await db.user.update({ where: { id: user.id }, data: { image } })
  return NextResponse.json({ success: true, image })
}

export async function DELETE() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.user.update({ where: { id: user.id }, data: { image: null } })
  return NextResponse.json({ success: true })
}
