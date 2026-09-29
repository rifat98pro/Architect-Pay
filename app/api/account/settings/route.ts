import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  username:    z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, underscores').optional(),
  displayName: z.string().min(1).max(50).optional(),
})

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await db.user.findUnique({
    where:  { id: user.id },
    select: { username: true, displayName: true, name: true, email: true, image: true },
  })

  return NextResponse.json({ user: data })
}

export async function PATCH(request: Request) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { username, displayName } = parsed.data

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(username    !== undefined && { username: username.toLowerCase() }),
        ...(displayName !== undefined && { displayName }),
      },
      select: { username: true, displayName: true, name: true, email: true },
    })
    return NextResponse.json({ user: updated })
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }
    throw err
  }
}
