import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, password, username, name } = body as Record<string, string>

  if (!email || !password || !username) {
    return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3–20 characters (letters, numbers, underscores)' }, { status: 400 })
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  })
  if (existing?.email === email)       return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  if (existing?.username === username) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  await db.user.create({
    data: { email, passwordHash, username, name: name || username, displayName: name || username },
  })

  return NextResponse.json({ success: true })
}
