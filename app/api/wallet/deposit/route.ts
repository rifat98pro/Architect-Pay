import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getOrCreateChainWalletId } from '@/lib/circle'
import { cctpTransfer } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  sourceChain: z.enum(CCTP_SOURCE_CHAINS),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Amount must be a valid number')
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { sourceChain, amount } = parsed.data

    const wallet = await db.wallet.findUnique({
      where:   { userId: user.id },
      include: { chainWallets: true },
    })
    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    if (!wallet.walletSetId) return NextResponse.json({ error: 'Wallet set not found' }, { status: 500 })

    // Resolve source chain wallet ID
    const cached = wallet.chainWallets.find((cw) => cw.chain === sourceChain)
    const sourceWalletId = cached?.circleWalletId
      ?? await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, sourceChain as CctpSourceChain)

    // CCTP: burn on source chain, mint to user's own Arc Testnet wallet
    const { mintTxHash } = await cctpTransfer({
      sourceChain:      sourceChain as CctpSourceChain,
      sourceWalletId,
      arcWalletId:      wallet.circleWalletId,
      recipientAddress: wallet.walletAddress, // mint to user's own Arc wallet
      amount,
    })

    return NextResponse.json({ success: true, mintTxHash })
  } catch (err: unknown) {
    console.error('[wallet/deposit]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
