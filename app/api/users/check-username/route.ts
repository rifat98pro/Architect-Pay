import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth-server'
import { lookupLimiter, checkRateLimit, getIP } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

const RULE = /^[a-z0-9_]{3,30}$/

/**
 * Is this username free?
 *
 * Deliberately separate from /api/users/lookup, which answers "can I pay this
 * person" and 404s for an account with no wallet yet. Reusing it here would
 * report a taken username as available.
 */
export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(lookupLimiter, getIP(request))
  if (limited) return limited

  const raw = new URL(request.url).searchParams
    .get('username')?.trim().replace(/^@/, '').toLowerCase() ?? ''

  if (!raw) {
    return NextResponse.json({ available: false, reason: 'Enter a username' })
  }
  if (raw.length < 3) {
    return NextResponse.json({ available: false, reason: 'At least 3 characters' })
  }
  if (raw.length > 30) {
    return NextResponse.json({ available: false, reason: 'At most 30 characters' })
  }
  if (!RULE.test(raw)) {
    return NextResponse.json({ available: false, reason: 'Lowercase letters, numbers and underscores only' })
  }

  const owner = await db.user.findUnique({ where: { username: raw }, select: { id: true } })

  // Your own current username is still "available" to you, so the field does not
  // flag itself while you edit the rest of the form.
  const me = await getUserFromRequest().catch(() => null)
  if (owner && owner.id === me?.id) {
    return NextResponse.json({ available: true, reason: 'This is your username' })
  }

  return owner
    ? NextResponse.json({ available: false, reason: 'Username not available' })
    : NextResponse.json({ available: true,  reason: 'Available' })
}
