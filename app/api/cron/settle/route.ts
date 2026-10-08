import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkTransaction, sendUsdcPayment } from '@/lib/circle'
import { checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'
import { logPayrollRunOnChain } from '@/lib/architect-pay-contract'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all PENDING CCTP entries across all users
  const pendingEntries = await db.payrollEntry.findMany({
    where:   { status: 'PENDING', cctpBurnCircleId: { not: null } },
    include: {
      employee:   true,
      payrollRun: { select: { id: true, userId: true, status: true, totalAmount: true } },
    },
  })

  let settled = 0

  for (const entry of pendingEntries) {
    try {
      const wallet = await db.wallet.findUnique({ where: { userId: entry.payrollRun.userId } })
      if (!wallet) continue

      // Phase A: resolve burn tx hash from Circle tx ID
      let burnTxHash = entry.burnTxHash
      if (!burnTxHash && entry.cctpBurnCircleId) {
        const { state, txHash } = await checkTransaction(entry.cctpBurnCircleId)
        if ((state === 'CONFIRMED' || state === 'COMPLETE') && txHash) {
          burnTxHash = txHash
          await db.payrollEntry.update({ where: { id: entry.id }, data: { burnTxHash: txHash } })
        }
      }

      // Phase B: check iris attestation — if ready, mint + send
      if (burnTxHash && entry.srcDomain && entry.receiverWalletId && entry.destTransmitter) {
        const att = await checkAttestationOnce(entry.srcDomain, burnTxHash)
        if (att) {
          await mintFromAttestation({
            message:          att.message,
            attestation:      att.attestation,
            receiverWalletId: entry.receiverWalletId,
            destTransmitter:  entry.destTransmitter,
          })
          const result = await sendUsdcPayment({
            fromWalletId: entry.receiverWalletId,
            toAddress:    entry.employee.walletAddress,
            amount:       entry.amount,
            token:        (entry.employee.preferredToken ?? 'USDC') as 'USDC' | 'EURC',
          })
          await db.payrollEntry.update({
            where: { id: entry.id },
            data:  { status: 'COMPLETED', circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null },
          })
          settled++

          // Recompute run status
          const runId    = entry.payrollRun.id
          const all      = await db.payrollEntry.findMany({ where: { payrollRunId: runId } })
          const pending  = all.filter((e) => e.status === 'PENDING' && e.cctpBurnCircleId).length
          if (pending === 0) {
            const done   = all.filter((e) => e.status === 'COMPLETED').length
            const fail   = all.filter((e) => e.status === 'FAILED').length
            const status = fail === 0 ? 'COMPLETED' : done === 0 ? 'FAILED' : 'PARTIAL'
            if (entry.payrollRun.status !== status) {
              await db.payrollRun.update({ where: { id: runId }, data: { status } })
              if (status === 'COMPLETED' || status === 'PARTIAL') {
                logPayrollRunOnChain(wallet.circleWalletId, entry.payrollRun.totalAmount, done)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[cron/settle] entry', entry.id, String(err))
    }
  }

  return NextResponse.json({ checked: pendingEntries.length, settled })
}
