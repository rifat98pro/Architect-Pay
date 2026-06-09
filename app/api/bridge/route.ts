import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { AppKit } from '@circle-fin/app-kit'
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets'
import { z } from 'zod'

export const maxDuration = 300

// Maps Circle wallet chain IDs → AppKit Blockchain enum values
const CHAIN_MAP: Record<string, string> = {
  'ARC-TESTNET':  'Arc_Testnet',
  'ETH-SEPOLIA':  'Ethereum_Sepolia',
  'BASE-SEPOLIA': 'Base_Sepolia',
  'ARB-SEPOLIA':  'Arbitrum_Sepolia',
  'MATIC-AMOY':   'Polygon_Amoy_Testnet',
}

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

  const kitFrom = CHAIN_MAP[fromChain]
  const kitTo   = CHAIN_MAP[toChain]
  if (!kitFrom || !kitTo) {
    return NextResponse.json({ error: `Unsupported chain: ${!kitFrom ? fromChain : toChain}` }, { status: 400 })
  }

  const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  try {
    const result = await kit.bridge({
      from: { adapter, chain: kitFrom as any, address: wallet.walletAddress },
      to:   { adapter, chain: kitTo   as any, address: wallet.walletAddress },
      amount,
    })

    return NextResponse.json({ success: true, steps: result.steps })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bridge failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
