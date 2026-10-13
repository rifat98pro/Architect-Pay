import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { checkTransaction, sendUsdcPayment, getWalletBalances } from '@/lib/circle'
import { checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'
import { type CctpSourceChain } from '@/lib/cctp-chains'
import { logPayrollRunOnChain } from '@/lib/architect-pay-contract'

export const maxDuration = 60

export async function POST(req: Request) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await req.json().catch(() => ({}))
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 })

  // Entries claimed as SENDING are owned by another in-flight settle call. Only
  // reclaim one if its claim has gone stale (process died mid-send).
  const staleCutoff = new Date(Date.now() - 3 * 60 * 1000)

  const run = await db.payrollRun.findUnique({
    where:   { id: runId, userId: user.id },
    select: {
      id:          true,
      userId:      true,
      status:      true,
      totalAmount: true,
      entries: {
        where: {
          cctpBurnCircleId: { not: null },
          OR: [
            { status: 'PENDING' },
            { status: 'SENDING', updatedAt: { lt: staleCutoff } },
          ],
        },
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
        } else if (state === 'FAILED' || state === 'CANCELLED') {
          throw new Error(`CCTP burn transaction ${state} — please retry this employee`)
        }
      }

      // Phase B: check iris attestation — if ready, mint + send to employee
      if (burnTxHash && entry.srcDomain && entry.receiverWalletId && entry.destTransmitter) {
        const att = await checkAttestationOnce(entry.srcDomain, burnTxHash)
        if (att) {
          // Try to call receiveMessage ourselves. If Circle's bundler rejects it for any
          // reason (ESTIMATION_ERROR, PAYMASTER, policy limits), fall back to checking
          // the receiver wallet balance — if Circle's auto-relay already minted, the
          // balance will be there and we can send immediately without waiting.
          try {
            await mintFromAttestation({
              message:          att.message,
              attestation:      att.attestation,
              receiverWalletId: entry.receiverWalletId,
              destTransmitter:  entry.destTransmitter,
              destChain:        (entry.employee.preferredChain ?? undefined) as CctpSourceChain | undefined,
            })
          } catch (mintErr) {
            const mintMsg = mintErr instanceof Error ? mintErr.message : String(mintErr)
            // FAILED_ON_ONCHAIN = Circle's relay already minted. Any other bundler
            // error (ESTIMATION_ERROR, PAYMASTER…) means the relay will mint instead.
            // Either way the balance check below decides whether we can send.
            console.warn('[payroll/settle] mint not done by us:', mintMsg)
          }

          // Send whatever actually landed — CCTP deducts its fee from the minted
          // amount, so the receiver holds slightly less than entry.amount.
          const empToken = (entry.employee.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
          let available  = 0
          try {
            const bals = await getWalletBalances(entry.receiverWalletId!)
            available  = parseFloat(empToken === 'EURC' ? bals.eurc : bals.usdc)
          } catch {
            console.warn('[payroll/settle] balance check failed, retrying next poll')
          }

          const sendAmount = Math.min(parseFloat(entry.amount), available)

          if (sendAmount <= 0) {
            // A stale SENDING claim with a drained receiver means the payout already
            // went out and we died before recording it — don't pay twice.
            if (entry.status === 'SENDING') {
              await db.payrollEntry.update({
                where: { id: entry.id },
                data:  { status: 'COMPLETED', errorMessage: null },
              })
              settled++
            } else {
              console.warn('[payroll/settle] receiver not funded yet, retrying next poll')
            }
            continue
          }

          // Claim atomically — the client poll and the cron both scan for settleable
          // entries and would otherwise each pay the employee once.
          const claim = await db.payrollEntry.updateMany({
            where: {
              id: entry.id,
              OR: [
                { status: 'PENDING' },
                { status: 'SENDING', updatedAt: { lt: staleCutoff } },
              ],
            },
            data: { status: 'SENDING' },
          })
          if (claim.count === 0) continue

          try {
            const result = await sendUsdcPayment({
              fromWalletId: entry.receiverWalletId,
              toAddress:    entry.employee.walletAddress,
              amount:       sendAmount.toFixed(6),
              token:        empToken,
            })
            await db.payrollEntry.update({
              where: { id: entry.id },
              data:  { status: 'COMPLETED', circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null },
            })
            settled++
          } catch (sendErr) {
            await db.payrollEntry.update({ where: { id: entry.id }, data: { status: 'PENDING' } })
            throw sendErr
          }
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

  // Recompute run status
  const allEntries     = await db.payrollEntry.findMany({ where: { payrollRunId: runId } })
  const pendingCount   = allEntries.filter((e) => e.status === 'PENDING' || e.status === 'SENDING').length
  const completedCount = allEntries.filter((e) => e.status === 'COMPLETED').length
  const failedCount    = allEntries.filter((e) => e.status === 'FAILED').length

  const finalStatus = pendingCount > 0
    ? 'PROCESSING'
    : failedCount === 0 ? 'COMPLETED' : completedCount === 0 ? 'FAILED' : 'PARTIAL'

  if (run.status !== finalStatus) {
    await db.payrollRun.update({ where: { id: runId }, data: { status: finalStatus } })
    if (finalStatus === 'COMPLETED' || finalStatus === 'PARTIAL') {
      const wallet = await db.wallet.findUnique({ where: { userId: user.id } })
      if (wallet) logPayrollRunOnChain(wallet.circleWalletId, run.totalAmount, completedCount)
    }
  }

  return NextResponse.json({ settled })
}
