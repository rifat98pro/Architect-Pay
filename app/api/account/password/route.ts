import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8, 'At least 8 characters').max(100),
})

/** Does this account have a password yet? An account created through Google has
 *  none, so the form asks for one instead of asking to confirm the old one. */
export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.user.findUnique({
    where:  { id: user.id },
    select: { passwordHash: true },
  })
  return NextResponse.json({ hasPassword: !!row?.passwordHash })
}

export async function POST(request: Request) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: first ?? 'Invalid input' }, { status: 400 })
  }

  const { currentPassword, newPassword } = parsed.data

  const row = await db.user.findUnique({
    where:  { id: user.id },
    select: { passwordHash: true },
  })

  // Changing an existing password requires proving you know it. Setting a first
  // password does not — the session already proves the account is theirs, and a
  // Google-only account has no old password to confirm.
  if (row?.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Enter your current password' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, row.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
  }

  await db.user.update({
    where: { id: user.id },
    data:  { passwordHash: await bcrypt.hash(newPassword, 10) },
  })

  return NextResponse.json({ ok: true, hasPassword: true })
}
