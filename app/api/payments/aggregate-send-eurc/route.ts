import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getWalletBalances, sendUsdcPayment, getOrCreateChainWalletId, waitForTokenBalance } from '@/lib/circle'
import { cctpBurn, cctpMint } from '@/lib/cctp'
import { paymentLimiter, checkRateLimit } from '@/lib/ratelimit'
import { EURC_CCTP_CHAINS, HUB_CHAIN, SOURCE_CHAIN_META, type EurcCctpChain } from '@/lib/cctp-chains'
import { computeEurcAggregatePlan } from '@/lib/aggregate'
import { calcFee, FEE_RECIPIENT } from '@/lib/fees'
import { z } from 'zod'

export const maxDuration = 300

const schema = z.object({
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount:           z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  destChain:        z.enum(EURC_CCTP_CHAINS).default('BASE-SEPOLIA'),
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

  // Only a payout that leaves the hub is a cross-chain transfer; paying someone on
  // the hub itself is a local send and carries no fee. The plan aggregates the fee
  // too, or the hub comes up short when we collect it.
  const isCrossChain = destChain !== HUB_CHAIN
  const platformFee  = isCrossChain ? calcFee(targetAmount) : 0

  const plan = computeEurcAggregatePlan(eurcBalances, targetAmount + platformFee, destChain)
  if (!plan.feasible) {
    const needed = platformFee > 0
      ? `${amount} + ${platformFee.toFixed(2)} fee`
      : amount
    return NextResponse.json(
      { error: `Insufficient EURC balance. Need ${needed} EURC across all chains.` },
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
      sourceChain:      'ALL_CHAINS',
      status:           'PROCESSING',
      destChain,
    },
  })

  try {
    // Step 1: Pull EURC from non-dest chains to dest chain via CCTPx (parallel)
    const cctpEntries = plan.plan.filter((e) => e.isCctp)
    const destWalletId = walletIds[destChain as EurcCctpChain]!

    // Burn first and record the result before minting. CCTPx without a FORWARD
    // request is a direct mint — nothing relays it — so if the mint leg is lost the
    // burn must still be recoverable from the payment row.
    async function bridgeLeg(
      from: EurcCctpChain, fromWalletId: string, to: EurcCctpChain, toWalletId: string, legAmount: string,
    ) {
      const burn = await cctpBurn({
        sourceChain:      from,
        sourceWalletId:   fromWalletId,
        destChain:        to,
        destWalletId:     toWalletId,
        arcWalletId:      wallet!.circleWalletId,
        recipientAddress: wallet!.walletAddress, // CCTPx mints to the user's own wallet
        amount:           legAmount,
        token:            'EURC',
      })

      await db.payment.update({
        where: { id: payment.id },
        data:  {
          burnTxHash:       burn.burnTxHash,
          srcDomain:        burn.srcDomain,
          receiverWalletId: burn.receiverWalletId,
          destTransmitter:  burn.destTransmitter,
          // Minting only gets the money to our own wallet on the destination chain.
          // Record what is still owed so a recovery finishes the payment instead of
          // stopping halfway and calling it complete.
          hopMeta:          JSON.stringify({
            payout:   true,
            walletId: destWalletId,
            to:       recipientAddress,
            amount,
            token:    'EURC',
          }),
        },
      }).catch(() => { /* recording is best-effort; never fail the burn over it */ })

      await cctpMint({ ...burn, destChain: to })
    }

    // Direct legs share no source wallet, so they can burn in parallel.
    const directEntries = cctpEntries.filter((e) => !e.viaHub)
    const hubEntries    = cctpEntries.filter((e) => e.viaHub)

    if (directEntries.length > 0) {
      await Promise.all(
        directEntries.map(async (entry) => {
          const srcChain    = entry.chain as EurcCctpChain
          const srcWalletId = walletIds[srcChain]
          if (!srcWalletId) throw new Error(`No wallet for ${srcChain}`)
          await bridgeLeg(srcChain, srcWalletId, destChain as EurcCctpChain, destWalletId, entry.amount)
        }),
      )
    }

    // Step 2: Pay the recipient everything that reached the destination chain
    // directly. Wait for the bridged funds to land, tolerating only a fee-sized
    // shortfall — paying less than requested while reporting success would hide a
    // bridge that did not deliver.
    const hubTotal    = hubEntries.reduce((sum, e) => sum + parseFloat(e.amount), 0)
    const directTotal = parseFloat((parseFloat(amount) - hubTotal).toFixed(6))
    let   directTxHash: string | null = null

    if (directTotal >= 0.000001) {
      const available = await waitForTokenBalance(destWalletId, directTotal.toFixed(6), 'EURC')
      if (available < directTotal * 0.99) {
        throw new Error(
          `Only ${available.toFixed(6)} EURC is available on the destination chain but ${directTotal.toFixed(6)} was requested. ` +
          `Your funds are safe — retry once the bridged amount has settled.`,
        )
      }
      const result = await sendUsdcPayment({
        fromWalletId: destWalletId,
        toAddress:    recipientAddress,
        amount:       Math.min(directTotal, available).toFixed(6),
        token:        'EURC',
      })
      directTxHash = result.txHash
    }

    // Step 3: Hand any hub-relayed remainder to the polled two-hop relay. Standard
    // finality off Ethereum or Base runs ~15 minutes — far past this function's
    // timeout — so the burn is recorded with hopMeta and /api/payments/[id]/mint
    // finishes it: mint on Arc, then burn Arc → destination straight to the
    // recipient. Doing it inline would strand the funds when the request died.
    if (hubEntries.length > 0) {
      const hubWalletId = walletIds[HUB_CHAIN as EurcCctpChain]
      if (!hubWalletId) throw new Error('No Arc wallet to relay through')
      const dstMeta = SOURCE_CHAIN_META[destChain as EurcCctpChain]

      // At most one leg can need a relay: of the three EURC chains one is the
      // destination and one is Arc, leaving a single chain that reaches neither
      // directly. Burn its whole share in one hop.
      const relayAmount = hubTotal.toFixed(6)
      const entry       = hubEntries[0]
      const srcChain    = entry.chain as EurcCctpChain
      const srcWalletId = walletIds[srcChain]
      if (!srcWalletId) throw new Error(`No wallet for ${srcChain}`)

      const hop1 = await cctpBurn({
        sourceChain:      srcChain,
        sourceWalletId:   srcWalletId,
        destChain:        HUB_CHAIN as EurcCctpChain,
        destWalletId:     hubWalletId,
        arcWalletId:      wallet.circleWalletId,
        recipientAddress: wallet.walletAddress, // hop 1 lands in the user's own Arc wallet
        amount:           relayAmount,
        token:            'EURC',
      })

      await db.payment.update({
        where: { id: payment.id },
        data:  {
          burnTxHash:       hop1.burnTxHash,
          srcDomain:        hop1.srcDomain,
          receiverWalletId: hop1.receiverWalletId,
          destTransmitter:  hop1.destTransmitter,
          hopMeta:          JSON.stringify({
            hop:                   1,
            arcWalletId:           hubWalletId,
            finalDestChain:        destChain,
            finalDestWalletId:     destWalletId,
            finalDestDomain:       dstMeta.cctpDomain,
            finalDestTransmitter:  dstMeta.messageTransmitterV2,
            finalRecipientAddress: recipientAddress,
            amount:                relayAmount,
            token:                 'EURC',
          }),
        },
      })

      return NextResponse.json({
        success:   true,
        paymentId: payment.id,
        pending:   true,
        txHash:    directTxHash,
      })
    }

    // Collected after the recipient is paid, and never allowed to fail the payment —
    // the transfer already happened, so a fee we could not take is our problem.
    if (platformFee > 0) {
      const hubWalletId = walletIds[HUB_CHAIN as EurcCctpChain]
      if (hubWalletId) {
        sendUsdcPayment({
          fromWalletId: hubWalletId,
          toAddress:    FEE_RECIPIENT,
          amount:       platformFee.toFixed(6),
          token:        'EURC',
        }).catch((e) => console.error('[aggregate-send-eurc] fee collection failed:', e))
      }
    }

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash: directTxHash },
    })

    return NextResponse.json({ success: true, paymentId: payment.id, txHash: directTxHash })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[aggregate-send-eurc]', message)

    // A burn cannot be undone. Once funds have left the source chain the payment is
    // in flight, not failed — the poller can still finish it, and marking it FAILED
    // both lies to the user and stops anything retrying. Only a failure before any
    // burn is a real failure.
    const current  = await db.payment.findUnique({ where: { id: payment.id } }).catch(() => null)
    const burned   = !!current?.burnTxHash
    await db.payment.update({
      where: { id: payment.id },
      data:  { status: burned ? 'PROCESSING' : 'FAILED', errorMessage: message },
    }).catch(() => {})

    return NextResponse.json(
      burned
        ? { error: message, paymentId: payment.id, pending: true }
        : { error: message },
      { status: burned ? 202 : 500 },
    )
  }
}
