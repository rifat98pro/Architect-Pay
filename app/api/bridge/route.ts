import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { AppKit } from '@circle-fin/app-kit'
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  amount:    z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  fromChain: z.string(),
  toChain:   z.string(),
})

const kit     = new AppKit()
const adapter = createCircleWalletsAdapter({
  apiKey:       process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { amount, fromChain, toChain } = parsed.data

  const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  try {
    const result = await kit.bridge({
      from: { adapter, chain: fromChain as any, address: wallet.walletAddress },
      to:   { adapter, chain: toChain as any,   address: wallet.walletAddress },
      amount,
    })

    return NextResponse.json({ success: true, steps: result.steps })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bridge failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
