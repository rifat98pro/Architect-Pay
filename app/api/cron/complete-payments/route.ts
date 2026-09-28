import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cctpMint } from '@/lib/cctp'
import { logPaymentOnChain } from '@/lib/architect-pay-contract'

export const maxDuration = 55 // just under Vercel's 60s hobby limit

const IRIS_API = 'https://iris-api-sandbox.circle.com'

async function isAttestationReady(srcDomain: number, burnTxHash: string): Promise<boolean> {
  try {
    const res = await fetch(`${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`)
    if (!res.ok) return false
    const data = await res.json()
    const msg  = data?.messages?.[0]
    return msg?.status === 'complete' && !!msg?.attestation && !!msg?.message
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (has secret header in prod)
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all PROCESSING cross-chain payments that have been burned but not minted
  const pending = await db.payment.findMany({
    where: {
      status:    'PROCESSING',
      burnTxHash: { not: null },
      srcDomain:  { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: 10, // process up to 10 per run to stay within timeout
  })

  const results: { id: string; result: string }[] = []

  for (const payment of pending) {
    // Skip if no burn info (shouldn't happen given query, but be safe)
    if (!payment.burnTxHash || payment.srcDomain == null || !payment.receiverWalletId || !payment.destTransmitter) {
      continue
    }

    // Quick check — don't wait, just see if attestation is ready now
    const ready = await isAttestationReady(payment.srcDomain, payment.burnTxHash)
    if (!ready) {
      results.push({ id: payment.id, result: 'waiting' })
      continue
    }

    try {
      const mintTxHash = await cctpMint({
        burnTxHash:       payment.burnTxHash,
        srcDomain:        payment.srcDomain,
        receiverWalletId: payment.receiverWalletId,
        destTransmitter:  payment.destTransmitter,
      })

      await db.payment.update({
        where: { id: payment.id },
        data:  { status: 'COMPLETED', txHash: mintTxHash },
      })

      // Log on-chain asynchronously (non-blocking)
      const sender = await db.user.findUnique({ where: { id: payment.senderId }, select: { wallet: { select: { circleWalletId: true } } } })
      if (sender?.wallet?.circleWalletId) {
        logPaymentOnChain(sender.wallet.circleWalletId, payment.recipientAddress, payment.amount, payment.recipientLabel ?? '')
      }

      results.push({ id: payment.id, result: 'completed', mintTxHash } as never)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron] failed to mint payment ${payment.id}:`, message)

      // After 3 hours of retries, mark as failed
      const ageMs = Date.now() - new Date(payment.createdAt).getTime()
      if (ageMs > 3 * 60 * 60 * 1000) {
        await db.payment.update({
          where: { id: payment.id },
          data:  { status: 'FAILED', errorMessage: `Mint failed after 3h: ${message}` },
        })
        results.push({ id: payment.id, result: 'failed', error: message } as never)
      } else {
        results.push({ id: payment.id, result: 'error', error: message } as never)
      }
    }
  }

  return NextResponse.json({ processed: pending.length, results })
}
