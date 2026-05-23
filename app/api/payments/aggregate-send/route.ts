import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances, sendUsdcPayment, getOrCreateChainWalletId } from '@/lib/circle'
import { cctpTransfer } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'
import { computeAggregatePlan } from '@/app/api/payments/aggregate-plan/route'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  label: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { recipientAddress, amount, label } = parsed.data
  const targetAmount = parseFloat(amount)

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  // Build chain wallet ID map
  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  // Fetch live balances and compute plan
  const balances    = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))
  const plan        = computeAggregatePlan(numericBals, targetAmount)

  if (!plan.feasible) {
    return NextResponse.json(
      { error: `Insufficient total balance. Need $${amount} USDC across all chains.` },
      { status: 400 },
    )
  }

  // Create payment record
  const payment = await db.payment.create({
    data: {
      senderId:         user.id,
      recipientAddress,
      recipientLabel:   label,
      amount,
      status:           'PROCESSING',
      destChain:        'ARC-TESTNET',
    },
  })

  try {
    // Step 1: Run CCTP pulls in parallel (non-Arc chains → user's own Arc wallet)
    const cctpEntries = plan.plan.filter((e) => e.isCctp)

    if (cctpEntries.length > 0) {
      await Promise.all(
        cctpEntries.map(async (entry) => {
          const chain = entry.chain as CctpSourceChain

          // Get or create chain wallet ID
          let sourceWalletId = chainWalletIds[chain]
          if (!sourceWalletId) {
            if (!wallet.walletSetId) throw new Error(`No wallet set ID for chain ${chain}`)
            sourceWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, chain)
          }

          await cctpTransfer({
            sourceChain:      chain,
            sourceWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress, // CCTP mints to user's own Arc wallet
            amount:           entry.amount,
          })
        }),
      )
    }

    // Step 2: Send from user's Arc wallet to the recipient
    const result = await sendUsdcPayment({
      fromWalletId: wallet.circleWalletId,
      toAddress:    recipientAddress,
      amount,
    })

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash: result.txHash },
    })

    return NextResponse.json({ success: true, paymentId: payment.id, txHash: result.txHash })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[aggregate-send]', message)
    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'FAILED', errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
