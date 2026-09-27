import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { swapTokens } from '@/lib/arc-kit'
import { z } from 'zod'

export const dynamic  = 'force-dynamic'
export const maxDuration = 120

const schema = z.object({
  tokenIn:  z.enum(['EURC', 'USDC']),
  tokenOut: z.enum(['EURC', 'USDC']),
  amountIn: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/)
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
}).refine((d) => d.tokenIn !== d.tokenOut, { message: 'tokenIn and tokenOut must differ' })

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { tokenIn, tokenOut, amountIn } = parsed.data

  const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  try {
    const result = await swapTokens({
      walletAddress: wallet.walletAddress,
      tokenIn,
      tokenOut,
      amountIn,
    })
    return NextResponse.json({ success: true, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Swap failed'
    console.error('[swap]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
