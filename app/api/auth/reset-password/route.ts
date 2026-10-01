import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, code, newPassword } = body as Record<string, string>

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const otp = await db.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) {
    return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 })
  }
  if (otp.expiresAt < new Date()) {
    await db.emailOtp.delete({ where: { id: otp.id } })
    return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 })
  }
  const validCode = await bcrypt.compare(code, otp.code)
  if (!validCode) {
    return NextResponse.json({ error: 'Incorrect verification code' }, { status: 400 })
  }

  await db.emailOtp.delete({ where: { id: otp.id } })

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { email },
    data:  { passwordHash },
  })

  return NextResponse.json({ success: true })
}
