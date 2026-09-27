import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { sendUsdcPayment, waitForTransaction, getWalletBalance, getOrCreateChainWalletId } from '@/lib/circle'
import { logPaymentOnChain } from '@/lib/architect-pay-contract'
import { cctpTransfer } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'
import { z } from 'zod'

export const maxDuration = 300 // 5-minute timeout for CCTP cross-chain flow

const schema = z.object({
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Amount must be a valid number')
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
  sourceChain: z.enum(CCTP_SOURCE_CHAINS).default('ARC-TESTNET'),
  destChain:   z.enum(CCTP_SOURCE_CHAINS).default('ARC-TESTNET'),
  token:       z.enum(['USDC', 'EURC']).default('USDC'),
  label: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { recipientAddress, amount, sourceChain, destChain, token, label } = parsed.data

  // Validate EURC chain support
  if (token === 'EURC') {
    const { EURC_CCTP_CHAINS } = await import('@/lib/cctp-chains')
    if (!EURC_CCTP_CHAINS.includes(sourceChain as never) || !EURC_CCTP_CHAINS.includes(destChain as never)) {
      return NextResponse.json(
        { error: 'EURC is only supported on Arc Testnet, Ethereum Sepolia, and Base Sepolia.' },
        { status: 400 },
      )
    }
  }

  const amountNum = parseFloat(amount)

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  // ── Resolve source wallet ID ────────────────────────────────────────────────
  let sourceWalletId: string
  if (sourceChain === 'ARC-TESTNET') {
    sourceWalletId = wallet.circleWalletId
  } else {
    const cached = wallet.chainWallets.find((cw) => cw.chain === sourceChain)
    if (cached) {
      sourceWalletId = cached.circleWalletId
    } else {
      if (!wallet.walletSetId) {
        return NextResponse.json({ error: 'Wallet set not found — please contact support' }, { status: 500 })
      }
      sourceWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, sourceChain as CctpSourceChain)
    }
  }

  // ── Balance check ───────────────────────────────────────────────────────────
  const { getWalletBalances } = await import('@/lib/circle')
  const bals = await getWalletBalances(sourceWalletId)
  const available = parseFloat(token === 'EURC' ? bals.eurc : bals.usdc)
  if (available < amountNum) {
    return NextResponse.json(
      { error: `Insufficient ${token} balance on ${sourceChain}. Available: ${available.toFixed(2)} ${token}` },
      { status: 400 },
    )
  }

  // ── Create payment record ───────────────────────────────────────────────────
  const payment = await db.payment.create({
    data: {
      senderId:         user.id,
      recipientAddress,
      recipientLabel:   label,
      amount,
      token,
      status:           'PROCESSING',
      destChain,
    },
  })

  try {
    let txHash: string | null = null

    if (sourceChain === destChain) {
      // ── Same-chain: direct Circle transfer ──────────────────────────────────
      const result = await sendUsdcPayment({
        fromWalletId: sourceWalletId,
        toAddress:    recipientAddress,
        amount,
        token,
      })
      txHash = result.txHash ?? await waitForTransaction(result.id)
    } else {
      // ── Cross-chain: CCTP transfer to destChain ─────────────────────────────
      const destWalletId = destChain === 'ARC-TESTNET'
        ? wallet.circleWalletId
        : await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain as CctpSourceChain)

      const { mintTxHash } = await cctpTransfer({
        sourceChain:      sourceChain as CctpSourceChain,
        sourceWalletId,
        destChain:        destChain === 'ARC-TESTNET' ? undefined : destChain as CctpSourceChain,
        destWalletId,
        arcWalletId:      wallet.circleWalletId,
        recipientAddress,
        amount,
        token,
      })
      txHash = mintTxHash
    }

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash },
    })

    logPaymentOnChain(wallet.circleWalletId, recipientAddress, amount, label ?? '')

    return NextResponse.json({ success: true, paymentId: payment.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[payments/send] failed:', message)
    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'FAILED', errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
