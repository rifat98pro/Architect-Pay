import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(authLimiter, `signup:${getIP(req)}`)
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const { email, password, username, name, code } = body as Record<string, string>

  if (!email || !password || !username || !code) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3–20 characters (letters, numbers, underscores)' }, { status: 400 })
  }

  // Verify OTP
  const otp = await db.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp)                          return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 })
  if (otp.expiresAt < new Date())    return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 })
  const valid = await bcrypt.compare(code.trim(), otp.code)
  if (!valid)                        return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 })

  // Check duplicates
  const existing = await db.user.findFirst({
    where:  { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  })
  if (existing?.email === email)       return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  if (existing?.username === username) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  await db.user.create({
    data: {
      email,
      passwordHash,
      username,
      name:          name || username,
      displayName:   name || username,
      emailVerified: new Date(),
    },
  })

  // Clean up used OTP
  await db.emailOtp.deleteMany({ where: { email } })

  return NextResponse.json({ success: true })
}
