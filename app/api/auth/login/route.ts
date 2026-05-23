import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken, setSessionCookie } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = signToken({ userId: user.id, email: user.email })
  setSessionCookie(token)

  return NextResponse.json({ ok: true, name: user.name, email: user.email })
}
