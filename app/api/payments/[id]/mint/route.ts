import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payment = await db.payment.findUnique({ where: { id: params.id } })
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
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash: mintTxHash },
    })

    return NextResponse.json({ status: 'COMPLETED', txHash: mintTxHash })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mint failed'
    // Don't mark as FAILED yet — attestation may succeed on retry
    console.error(`[payments/${params.id}/mint] mint error:`, message)
    return NextResponse.json({ status: 'PROCESSING', error: message })
  }
}
