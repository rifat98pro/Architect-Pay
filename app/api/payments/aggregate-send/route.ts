import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances, sendUsdcPayment, waitForTransaction, getOrCreateChainWalletId, waitForTokenBalance, getWalletBalances } from '@/lib/circle'
import { paymentLimiter, checkRateLimit } from '@/lib/ratelimit'
import { logPaymentOnChain } from '@/lib/architect-pay-contract'
import { cctpTransfer } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, HUB_CHAIN, type CctpSourceChain } from '@/lib/cctp-chains'
import { computeAggregatePlan } from '@/lib/aggregate'
import { calcFee, FEE_RECIPIENT } from '@/lib/fees'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  destChain: z.enum(CCTP_SOURCE_CHAINS).default('BASE-SEPOLIA'),
  label: z.string().max(100).optional(),
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

  // Build chain wallet ID map
  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  // Fetch live balances and compute plan
  // Only a payout that leaves the hub is a cross-chain transfer; paying someone on
  // the hub itself is a local send and carries no fee. The plan has to aggregate the
  // fee as well as the amount, or the hub comes up short when we collect it.
  const isCrossChain = destChain !== HUB_CHAIN
  const percentFee   = isCrossChain ? calcFee(targetAmount) : 0

  const balances    = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))

  const platformFee  = percentFee
  const plan        = computeAggregatePlan(numericBals, targetAmount + platformFee, HUB_CHAIN)

  if (!plan.feasible) {
    const needed = platformFee > 0
      ? `$${amount} + $${platformFee.toFixed(2)} fee`
      : `$${amount}`
    return NextResponse.json(
      { error: `Insufficient total balance. Need ${needed} USDC across all chains.` },
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
      sourceChain:      'ALL_CHAINS',
      status:           'PROCESSING',
      destChain,
    },
  })

  try {
    // Step 1: Run CCTP pulls in parallel (non-Base chains → user's own Base wallet)
    const cctpEntries = plan.plan.filter((e) => e.isCctp)

    let hubWalletId = HUB_CHAIN === 'ARC-TESTNET' ? wallet.circleWalletId : chainWalletIds[HUB_CHAIN]
    if (!hubWalletId) {
      if (!wallet.walletSetId) throw new Error('No wallet set ID for Base chain')
      hubWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, HUB_CHAIN)
    }

    if (cctpEntries.length > 0) {
      await Promise.all(
        cctpEntries.map(async (entry) => {
          const chain = entry.chain as CctpSourceChain

          let sourceWalletId = chainWalletIds[chain]
          if (!sourceWalletId) {
            if (!wallet.walletSetId) throw new Error(`No wallet set ID for chain ${chain}`)
            sourceWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, chain)
          }

          await cctpTransfer({
            sourceChain:      chain,
            sourceWalletId,
            destChain:        HUB_CHAIN,
            destWalletId:     hubWalletId!,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
        }),
      )
    }

    // Step 2a: Route to destination wallet. Funds are already aggregated on the hub,
    // so a payout on the hub chain sends straight from it; anything else bridges.
    let sendFromWalletId = hubWalletId
    if (destChain !== HUB_CHAIN) {
      const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain)

      // Aggregation loses a little to CCTP fees on each leg, so the hub holds
      // slightly less than the target. Burn what actually landed, not what was
      // asked for — burning more than the balance reverts with INSUFFICIENT_TOKEN.
      const hubBal   = await getWalletBalances(hubWalletId!)
      const onHub    = parseFloat(hubBal.usdc)
      const burnAmt  = Math.min(parseFloat(amount), onHub).toFixed(6)
      if (parseFloat(burnAmt) <= 0) {
        throw new Error('No USDC available on the hub chain to bridge. Your funds are safe — retry shortly.')
      }

      try {
        await cctpTransfer({
          sourceChain:      HUB_CHAIN,
          sourceWalletId:   hubWalletId!,
          destChain,
          destWalletId,
          arcWalletId:      wallet.circleWalletId,
          recipientAddress: wallet.walletAddress,
          amount:           burnAmt,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!msg.includes('[mint-receiveMessage]')) throw e
        // Circle bundler failed for receiveMessage but the CCTP V2 relay (destinationCaller=0x0)
        // auto-delivers the mint on-chain. Wait 20s for relay to settle before proceeding.
        console.warn('[aggregate-send] mint bundler failed, waiting for auto-relay:', msg)
        await new Promise((r) => setTimeout(r, 20_000))
      }
      sendFromWalletId = destWalletId
    }

    // Step 2b: Send from destination wallet to recipient.
    // CCTP takes its fee out of the bridged amount and the mint can land after
    // cctpTransfer returns, so wait for the funds and tolerate a shortfall only
    // as large as the fee. Anything bigger means the bridge did not deliver, and
    // paying a reduced amount while reporting success would hide that.
    const requested = parseFloat(amount)
    const available = await waitForTokenBalance(sendFromWalletId, amount)
    if (available < requested * 0.99) {
      throw new Error(
        `Only ${available.toFixed(6)} USDC is available on the destination chain but ${requested.toFixed(6)} was requested. ` +
        `Your funds are safe — retry once the bridged amount has settled.`,
      )
    }

    const sendAmount = Math.min(requested, available).toFixed(6)
    const result = await sendUsdcPayment({
      fromWalletId: sendFromWalletId,
      toAddress:    recipientAddress,
      amount:       sendAmount,
    })

    let txHash: string | null = result.txHash
    if (!txHash) {
      try { txHash = await waitForTransaction(result.id) } catch { /* send submitted — txHash lookup timed out */ }
    }

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash },
    })

    // Collected after the recipient is paid, and never allowed to fail the payment —
    // the transfer already happened, so a fee we could not take is our problem.
    if (platformFee > 0) {
      sendUsdcPayment({
        fromWalletId: hubWalletId!,
        toAddress:    FEE_RECIPIENT,
        amount:       platformFee.toFixed(6),
      }).catch((e) => console.error('[aggregate-send] fee collection failed:', e))
    }

    logPaymentOnChain(wallet.circleWalletId, recipientAddress, amount, label ?? '')

    return NextResponse.json({ success: true, paymentId: payment.id, txHash })
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
