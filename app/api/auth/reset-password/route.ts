import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(authLimiter, `reset-pwd:${getIP(req)}`)
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const { email, token, password } = body as Record<string, string>

  if (!email || !token || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const record = await db.passwordResetToken.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })

  if (!record)                       return NextResponse.json({ error: 'Reset link is invalid or expired.' }, { status: 400 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 })

  const valid = await bcrypt.compare(token, record.token)
  if (!valid) return NextResponse.json({ error: 'Reset link is invalid or expired.' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  await db.user.update({ where: { email }, data: { passwordHash } })
  await db.passwordResetToken.deleteMany({ where: { email } })

  return NextResponse.json({ success: true })
}
