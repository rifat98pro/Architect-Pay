import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Has this account already been through the welcome tour? */
export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.user.findUnique({
    where:  { id: user.id },
    select: { onboardedAt: true },
  })
  return NextResponse.json({ onboarded: !!row?.onboardedAt })
}

/** Mark it done. Stored on the user rather than in the browser, so signing in
 *  from another device or after clearing site data does not repeat the tour. */
export async function POST() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.user.update({
    where: { id: user.id },
    data:  { onboardedAt: new Date() },
  })
  return NextResponse.json({ onboarded: true })
}
