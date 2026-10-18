import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { checkAttestationOnce, mintFromAttestation, cctpBurnFast } from '@/lib/cctp'
import { checkTransaction, getWalletBalances, sendUsdcPayment } from '@/lib/circle'
import { type CctpSourceChain } from '@/lib/cctp-chains'

export const maxDuration = 60

/** A bridge that lands in the user's own wallet still owes the recipient a local
 *  send. Without this the mint looked like the end of the payment and the route
 *  marked it COMPLETED while the recipient had been paid nothing. */
type PayoutMeta = {
  payout:   true
  walletId: string
  to:       string
  amount:   string
  token:    'USDC' | 'EURC'
}

type HopMeta = {
  hop:                   number
  arcWalletId:           string
  finalDestChain:        string
  finalDestWalletId:     string
  finalDestDomain:       number
  finalDestTransmitter:  string
  finalRecipientAddress: string
  amount:                string
  token:                 string
}

/** After a mint succeeds, check whether this is hop 1 of a 2-hop bridge.
 *  If so, start hop 2 (Arc → final destination) and return PROCESSING.
 *  Otherwise mark the payment COMPLETED. */
async function finishOrContinueHop(
  id:           string,
  mintTxHash:   string,
  hopMetaRaw:   string | null,
): Promise<NextResponse> {
  let parsed: (HopMeta & Partial<PayoutMeta>) | null = null
  if (hopMetaRaw) {
    try { parsed = JSON.parse(hopMetaRaw) as HopMeta & Partial<PayoutMeta> } catch { /* ignore — fall through to COMPLETED */ }
  }

  // The bridged funds landed in the user's own wallet on the destination chain and
  // the recipient still has to be paid out of it. Check rather than wait: this route
  // is polled, so a mint that has not shown up in the balance yet is simply picked
  // up on the next tick instead of holding the request open.
  if (parsed?.payout) {
    const payout    = parsed as unknown as PayoutMeta
    const requested = parseFloat(payout.amount)
    try {
      const bals      = await getWalletBalances(payout.walletId)
      const available = parseFloat(payout.token === 'EURC' ? bals.eurc : bals.usdc)
      if (available < requested * 0.99) {
        return NextResponse.json({ status: 'PROCESSING' })
      }

      const result = await sendUsdcPayment({
        fromWalletId: payout.walletId,
        toAddress:    payout.to,
        amount:       Math.min(requested, available).toFixed(6),
        token:        payout.token,
      })
      await db.payment.update({
        where: { id },
        data:  { status: 'COMPLETED', txHash: result.txHash ?? mintTxHash, hopMeta: null, errorMessage: null },
      })
      return NextResponse.json({ status: 'COMPLETED', txHash: result.txHash ?? mintTxHash })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payout failed'
      console.error(`[payments/${id}/mint] payout error:`, message)
      // Stay PROCESSING. The money is in the user's own wallet and the send is
      // replayable; marking this FAILED would strand it with nothing retrying.
      await db.payment.update({ where: { id }, data: { errorMessage: message } }).catch(() => {})
      return NextResponse.json({ status: 'PROCESSING', error: message })
    }
  }

  const hopData = parsed

  if (hopData?.hop === 1) {
    try {
      const hop2Burn = await cctpBurnFast({
        sourceChain:      'ARC-TESTNET',
        sourceWalletId:   hopData.arcWalletId,
        destChain:        hopData.finalDestChain as CctpSourceChain,
        destWalletId:     hopData.finalDestWalletId,
        arcWalletId:      hopData.arcWalletId,
        recipientAddress: hopData.finalRecipientAddress,
        amount:           hopData.amount,
        token:            hopData.token as 'USDC' | 'EURC',
      })
      await db.payment.update({
        where: { id },
        data: {
          burnTxHash:       `circle_tx:${hop2Burn.burnCircleTxId}`,
          srcDomain:        hop2Burn.srcDomain,
          receiverWalletId: hopData.finalDestWalletId,
          destTransmitter:  hopData.finalDestTransmitter,
          hopMeta:          JSON.stringify({ ...hopData, hop: 2 }),
        },
      })
      return NextResponse.json({ status: 'PROCESSING' })
    } catch (hopErr: unknown) {
      const msg = hopErr instanceof Error ? hopErr.message : 'Hop 2 failed'
      await db.payment.update({ where: { id }, data: { status: 'FAILED', errorMessage: msg } })
      return NextResponse.json({ status: 'FAILED', error: msg })
    }
  }

  await db.payment.update({ where: { id }, data: { status: 'COMPLETED', txHash: mintTxHash } })
  return NextResponse.json({ status: 'COMPLETED', txHash: mintTxHash })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment || payment.senderId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (payment.status === 'COMPLETED') {
    return NextResponse.json({ status: 'COMPLETED', txHash: payment.txHash })
  }

  if (payment.status === 'FAILED') {
    return NextResponse.json({ status: 'FAILED', error: payment.errorMessage })
  }

  if (!payment.burnTxHash || payment.srcDomain == null || !payment.receiverWalletId || !payment.destTransmitter) {
    return NextResponse.json({ status: 'PROCESSING' })
  }

  // ── If we stored a Circle tx ID (burn submitted but not yet confirmed) ────────
  if (payment.burnTxHash.startsWith('circle_tx:')) {
    const circleId = payment.burnTxHash.replace('circle_tx:', '')
    const { state, txHash } = await checkTransaction(circleId)

    if (state === 'FAILED' || state === 'CANCELLED') {
      await db.payment.update({ where: { id }, data: { status: 'FAILED', errorMessage: `Burn tx ${state}` } })
      return NextResponse.json({ status: 'FAILED', error: `Burn transaction ${state}` })
    }

    if ((state === 'CONFIRMED' || state === 'COMPLETE') && txHash) {
      // Upgrade stored hash to on-chain tx hash
      await db.payment.update({ where: { id }, data: { burnTxHash: txHash } })
      // Fall through to Iris check with the real on-chain hash
      const result = await checkAttestationOnce(payment.srcDomain, txHash)
      if (!result) return NextResponse.json({ status: 'PROCESSING' })

      try {
        const mintTxHash = await mintFromAttestation({
          message:          result.message,
          attestation:      result.attestation,
          receiverWalletId: payment.receiverWalletId,
          destTransmitter:  payment.destTransmitter,
        })
        return finishOrContinueHop(id, mintTxHash, payment.hopMeta ?? null)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Mint failed'
        console.error(`[payments/${id}/mint] mint error:`, message)
        return NextResponse.json({ status: 'PROCESSING', error: message })
      }
    }

    // Still QUEUED / SENT — not yet confirmed on-chain
    return NextResponse.json({ status: 'PROCESSING' })
  }

  // ── Burn already confirmed — check Iris for attestation ──────────────────────
  const result = await checkAttestationOnce(payment.srcDomain, payment.burnTxHash)
  if (!result) {
    return NextResponse.json({ status: 'PROCESSING' })
  }

  try {
    const mintTxHash = await mintFromAttestation({
      message:          result.message,
      attestation:      result.attestation,
      receiverWalletId: payment.receiverWalletId,
      destTransmitter:  payment.destTransmitter,
    })
    return finishOrContinueHop(id, mintTxHash, payment.hopMeta ?? null)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mint failed'
    console.error(`[payments/${id}/mint] mint error:`, message)
    return NextResponse.json({ status: 'PROCESSING', error: message })
  }
}
