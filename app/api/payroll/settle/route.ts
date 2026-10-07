import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { checkTransaction, sendUsdcPayment } from '@/lib/circle'
import { checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'

export const maxDuration = 60

export async function POST(req: Request) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await req.json().catch(() => ({}))
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 })

  const run = await db.payrollRun.findUnique({
    where:   { id: runId, userId: user.id },
    include: {
      entries: {
        where:   { status: 'PENDING', cctpBurnCircleId: { not: null } },
        include: { employee: true },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  let settled = 0

  for (const entry of run.entries) {
    try {
      // Phase A: get blockchain burn tx hash from Circle tx ID
      let burnTxHash = entry.burnTxHash
      if (!burnTxHash && entry.cctpBurnCircleId) {
        const { state, txHash } = await checkTransaction(entry.cctpBurnCircleId)
        if ((state === 'CONFIRMED' || state === 'COMPLETE') && txHash) {
          burnTxHash = txHash
          await db.payrollEntry.update({ where: { id: entry.id }, data: { burnTxHash: txHash } })
        }
      }

      // Phase B: check iris attestation — if ready, mint + send to employee
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
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Settlement failed'
      await db.payrollEntry.update({
        where: { id: entry.id },
        data:  { status: 'FAILED', errorMessage: message },
      })
    }
  }

  // Recompute run status once all pending CCTP entries are resolved
  const allEntries   = await db.payrollEntry.findMany({ where: { payrollRunId: runId } })
  const stillPending = allEntries.filter((e) => e.status === 'PENDING' && e.cctpBurnCircleId).length
  if (stillPending === 0) {
    const completed   = allEntries.filter((e) => e.status === 'COMPLETED').length
    const failed      = allEntries.filter((e) => e.status === 'FAILED').length
    const finalStatus = failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
    await db.payrollRun.update({ where: { id: runId }, data: { status: finalStatus } })
  }

  return NextResponse.json({ settled })
}
