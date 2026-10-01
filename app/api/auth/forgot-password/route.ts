import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateOtp, sendVerificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email } = body as Record<string, string>

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // Always respond with sent:true even if email not found (prevents user enumeration)
  const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } })
  if (!user || !user.passwordHash) {
    // Google-only account or non-existent — silently succeed
    return NextResponse.json({ sent: true })
  }

  // Rate-limit: block resend if a fresh OTP was created in the last 60 seconds
  const recent = await db.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })
  if (recent && recent.createdAt > new Date(Date.now() - 60_000)) {
    return NextResponse.json({ error: 'Please wait 60 seconds before requesting a new code' }, { status: 429 })
  }

  await db.emailOtp.deleteMany({ where: { email } })

  const code      = generateOtp()
  const hashed    = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.emailOtp.create({ data: { email, code: hashed, expiresAt } })
  await sendVerificationEmail(email, code)

  return NextResponse.json({ sent: true })
}
