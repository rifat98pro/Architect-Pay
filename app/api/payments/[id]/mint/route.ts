import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'
import { checkTransaction } from '@/lib/circle'

export const maxDuration = 60

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
        await db.payment.update({ where: { id }, data: { status: 'COMPLETED', txHash: mintTxHash } })
        return NextResponse.json({ status: 'COMPLETED', txHash: mintTxHash })
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

    await db.payment.update({
      where: { id },
      data:  { status: 'COMPLETED', txHash: mintTxHash },
    })

    return NextResponse.json({ status: 'COMPLETED', txHash: mintTxHash })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mint failed'
    console.error(`[payments/${id}/mint] mint error:`, message)
    return NextResponse.json({ status: 'PROCESSING', error: message })
  }
}
