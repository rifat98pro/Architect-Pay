import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateOtp, sendVerificationEmail } from '@/lib/email'
import { otpLimiter, authLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const ip   = getIP(req)
  const body = await req.json().catch(() => ({}))
  const { email, username, password } = body as Record<string, string>

  // IP-based limit first, then per-email OTP limit
  const ipBlock  = await checkRateLimit(authLimiter, `send-otp:${ip}`)
  if (ipBlock) return ipBlock
  if (email) {
    const emailBlock = await checkRateLimit(otpLimiter, `otp:${email}`)
    if (emailBlock) return emailBlock
  }

  if (!email || !password || !username) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
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

  // Rate-limit: block resend if a fresh OTP was created in the last 60 seconds
  const recent = await db.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })
  if (recent && recent.createdAt > new Date(Date.now() - 60_000)) {
    return NextResponse.json({ error: 'Please wait 60 seconds before requesting a new code' }, { status: 429 })
  }

  // Remove any existing OTPs for this email
  await db.emailOtp.deleteMany({ where: { email } })

  const code     = generateOtp()
  const hashed   = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.emailOtp.create({ data: { email, code: hashed, expiresAt } })
  await sendVerificationEmail(email, code)

  return NextResponse.json({ sent: true })
}
