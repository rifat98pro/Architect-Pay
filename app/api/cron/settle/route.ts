import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkTransaction, sendUsdcPayment, getWalletBalances } from '@/lib/circle'
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
        } else if (state === 'FAILED' || state === 'CANCELLED') {
          throw new Error(`CCTP burn transaction ${state} — please retry this employee`)
        }
      }

      // Phase B: check iris attestation — if ready, mint + send
      if (burnTxHash && entry.srcDomain && entry.receiverWalletId && entry.destTransmitter) {
        const att = await checkAttestationOnce(entry.srcDomain, burnTxHash)
        if (att) {
          let receiverFunded = false
          try {
            await mintFromAttestation({
              message:          att.message,
              attestation:      att.attestation,
              receiverWalletId: entry.receiverWalletId,
              destTransmitter:  entry.destTransmitter,
            })
            receiverFunded = true
          } catch (mintErr) {
            const mintMsg = mintErr instanceof Error ? mintErr.message : String(mintErr)
            if (mintMsg.includes('FAILED_ON_ONCHAIN')) {
              console.warn('[cron/settle] mint already relayed by Circle:', mintMsg)
              receiverFunded = true
            } else {
              console.warn('[cron/settle] mint bundler error, checking receiver balance:', mintMsg)
              try {
                const empToken = (entry.employee.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
                const bals     = await getWalletBalances(entry.receiverWalletId!)
                const bal      = parseFloat(empToken === 'EURC' ? bals.eurc : bals.usdc)
                if (bal >= parseFloat(entry.amount)) {
                  console.log('[cron/settle] receiver wallet funded by Circle relay, proceeding to send')
                  receiverFunded = true
                } else {
                  console.warn('[cron/settle] receiver wallet not yet funded, retrying next poll')
                }
              } catch {
                console.warn('[cron/settle] could not check receiver balance, retrying next poll')
              }
            }
          }
          if (!receiverFunded) continue
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
          const runId      = entry.payrollRun.id
          const all        = await db.payrollEntry.findMany({ where: { payrollRunId: runId } })
          const pending    = all.filter((e) => e.status === 'PENDING').length
          const done       = all.filter((e) => e.status === 'COMPLETED').length
          const fail       = all.filter((e) => e.status === 'FAILED').length
          const newStatus  = pending > 0 ? 'PROCESSING' : fail === 0 ? 'COMPLETED' : done === 0 ? 'FAILED' : 'PARTIAL'
          if (entry.payrollRun.status !== newStatus) {
            await db.payrollRun.update({ where: { id: runId }, data: { status: newStatus } })
            if (newStatus === 'COMPLETED' || newStatus === 'PARTIAL') {
              logPayrollRunOnChain(wallet.circleWalletId, entry.payrollRun.totalAmount, done)
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
