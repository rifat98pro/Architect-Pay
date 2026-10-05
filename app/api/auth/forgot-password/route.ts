import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { otpLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(otpLimiter, `forgot-pwd:${getIP(req)}`)
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const { email } = body as { email: string }

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email } })
  // Always return success so we don't reveal if an email is registered
  if (!user || !user.passwordHash) return NextResponse.json({ sent: true })

  // Rate-limit: one reset per 60s
  const recent = await db.passwordResetToken.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })
  if (recent && recent.createdAt > new Date(Date.now() - 60_000)) {
    return NextResponse.json({ sent: true }) // silent rate limit
  }

  await db.passwordResetToken.deleteMany({ where: { email } })

  const rawToken  = crypto.randomBytes(32).toString('hex')
  const hashed    = await bcrypt.hash(rawToken, 10)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.passwordResetToken.create({ data: { email, token: hashed, expiresAt } })

  const appUrl   = process.env.NEXTAUTH_URL ?? 'https://architectpay.website'
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`

  await sendPasswordResetEmail(email, resetUrl)

  return NextResponse.json({ sent: true })
}
