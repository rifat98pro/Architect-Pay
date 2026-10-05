import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getWalletBalances, sendUsdcPayment, getOrCreateChainWalletId } from '@/lib/circle'
import { cctpTransfer } from '@/lib/cctp'
import { paymentLimiter, checkRateLimit } from '@/lib/ratelimit'
import { EURC_CCTP_CHAINS, type EurcCctpChain } from '@/lib/cctp-chains'
import { computeEurcAggregatePlan } from '@/lib/aggregate'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount:           z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  destChain:        z.enum(EURC_CCTP_CHAINS).default('ARC-TESTNET'),
  label:            z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimited = await checkRateLimit(paymentLimiter, `payment:${user.id}`)
  if (rateLimited) return rateLimited

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { recipientAddress, amount, destChain, label } = parsed.data
  const targetAmount = parseFloat(amount)

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  // Resolve wallet IDs for all 3 EURC chains
  const walletIds: Partial<Record<EurcCctpChain, string>> = {}
  for (const chain of EURC_CCTP_CHAINS) {
    if (chain === 'ARC-TESTNET') {
      walletIds[chain] = wallet.circleWalletId
    } else {
      const cached = wallet.chainWallets.find((cw) => cw.chain === chain)
      if (cached) {
        walletIds[chain] = cached.circleWalletId
      } else {
        if (!wallet.walletSetId) continue
        walletIds[chain] = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, chain)
      }
    }
  }

  // Fetch live EURC balances
  const eurcBalances: Record<string, number> = {}
  await Promise.allSettled(
    Object.entries(walletIds).map(async ([chain, id]) => {
      const bals = await getWalletBalances(id!)
      eurcBalances[chain] = parseFloat(bals.eurc)
    }),
  )

  const plan = computeEurcAggregatePlan(eurcBalances, targetAmount, destChain)
  if (!plan.feasible) {
    return NextResponse.json(
      { error: `Insufficient EURC balance. Need ${amount} EURC across all chains.` },
      { status: 400 },
    )
  }

  const payment = await db.payment.create({
    data: {
      senderId:         user.id,
      recipientAddress,
      recipientLabel:   label,
      amount,
      token:            'EURC',
      status:           'PROCESSING',
      destChain,
    },
  })

  try {
    // Step 1: Pull EURC from non-dest chains to dest chain via CCTPx (parallel)
    const cctpEntries = plan.plan.filter((e) => e.isCctp)
    const destWalletId = walletIds[destChain as EurcCctpChain]!

    if (cctpEntries.length > 0) {
      await Promise.all(
        cctpEntries.map(async (entry) => {
          const srcChain    = entry.chain as EurcCctpChain
          const srcWalletId = walletIds[srcChain]
          if (!srcWalletId) throw new Error(`No wallet for ${srcChain}`)

          await cctpTransfer({
            sourceChain:      srcChain,
            sourceWalletId:   srcWalletId,
            destChain:        destChain as EurcCctpChain,
            destWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress, // CCTPx mints to user's own dest wallet
            amount:           entry.amount,
            token:            'EURC',
          })
        }),
      )
    }

    // Step 2: Send from dest chain wallet to recipient
    const result = await sendUsdcPayment({
      fromWalletId: destWalletId,
      toAddress:    recipientAddress,
      amount,
      token:        'EURC',
    })

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash: result.txHash },
    })

    return NextResponse.json({ success: true, paymentId: payment.id, txHash: result.txHash })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[aggregate-send-eurc]', message)
    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'FAILED', errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
