import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { sendUsdcPayment, getOrCreateChainWalletId, checkTransaction } from '@/lib/circle'
import { cctpBurnFast } from '@/lib/cctp'
import { type CctpSourceChain } from '@/lib/cctp-chains'

export const maxDuration = 60

// Chains we pay EURC from directly, without bridging. Employees stored on any other
// chain fall back to Base. Bridging EURC further is configured but unproven, so it is
// kept out of the payroll path until a real cross-chain EURC transfer settles.
const EURC_CHAINS = ['ARC-TESTNET', 'BASE-SEPOLIA']

export async function POST(req: Request) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await req.json().catch(() => ({}))
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 })

  const run = await db.payrollRun.findUnique({
    where:   { id: runId, userId: user.id },
    include: {
      entries: {
        where:   { status: 'FAILED' },
        include: { employee: true },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'FAILED' && run.status !== 'PARTIAL') {
    return NextResponse.json({ error: 'Only FAILED or PARTIAL runs can be retried' }, { status: 400 })
  }

  const failedEntries = run.entries
  if (failedEntries.length === 0) {
    return NextResponse.json({ error: 'No failed entries to retry' }, { status: 400 })
  }

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const baseWalletId = wallet.chainWallets.find((cw) => cw.chain === 'BASE-SEPOLIA')?.circleWalletId
    ?? await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, 'BASE-SEPOLIA')

  await db.payrollRun.update({ where: { id: run.id }, data: { status: 'PROCESSING' } })

  const results = await Promise.allSettled(
    failedEntries.map(async (entry) => {
      const emp      = entry.employee
      const empToken = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
      const empChain = (emp.preferredChain ?? 'BASE-SEPOLIA') as CctpSourceChain

      // Relay already minted: FAILED_ON_ONCHAIN means Circle's relay processed receiveMessage
      // before our bundler did. Funds are on receiverWalletId — skip re-burn, just send.
      if (entry.errorMessage?.includes('FAILED_ON_ONCHAIN') && entry.receiverWalletId) {
        const result = await sendUsdcPayment({
          fromWalletId: entry.receiverWalletId,
          toAddress:    emp.walletAddress,
          amount:       entry.amount,
          token:        empToken,
        })
        await db.payrollEntry.update({
          where: { id: entry.id },
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null },
        })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }

      // Double-pay check: if a Circle tx was already submitted and confirmed, mark complete
      if (entry.circleTxId && !entry.cctpBurnCircleId) {
        const { state, txHash } = await checkTransaction(entry.circleTxId)
        if (state === 'CONFIRMED' || state === 'COMPLETE') {
          await db.payrollEntry.update({
            where: { id: entry.id },
            data:  { status: 'COMPLETED', txHash: txHash ?? entry.txHash ?? undefined, errorMessage: null },
          })
          return { entryId: entry.id, txHash: txHash ?? null, asyncCctp: false as const, alreadyDone: true }
        }
        if (state !== 'FAILED' && state !== 'CANCELLED') {
          throw new Error('Transaction still processing — please wait and try again shortly.')
        }
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: null, txHash: null } })
      }

      // EURC on Arc: send directly from Arc wallet (EURC lives natively on Arc)
      const isEurcArcDest = empToken === 'EURC' &&
        (EURC_CHAINS.includes(empChain) ? empChain : 'BASE-SEPOLIA') === 'ARC-TESTNET'

      if (isEurcArcDest) {
        const result = await sendUsdcPayment({
          fromWalletId: wallet.circleWalletId,
          toAddress:    emp.walletAddress,
          amount:       entry.amount,
          token:        empToken,
        })
        await db.payrollEntry.update({
          where: { id: entry.id },
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null },
        })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }

      const isBaseDest = empToken === 'EURC'
        ? (EURC_CHAINS.includes(empChain) ? empChain : 'BASE-SEPOLIA') === 'BASE-SEPOLIA'
        : empChain === 'BASE-SEPOLIA'
      // USDC Arc employees now go via CCTP burn Base→Arc (same as ARB/OP/etc.)

      // Base-to-Base: send immediately
      if (isBaseDest) {
        const result = await sendUsdcPayment({
          fromWalletId: baseWalletId,
          toAddress:    emp.walletAddress,
          amount:       entry.amount,
          token:        empToken,
        })
        await db.payrollEntry.update({
          where: { id: entry.id },
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null },
        })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }

      // Cross-chain: fire async burn (settle route / cron handles mint+send)
      const destChain = (empToken === 'EURC'
        ? (EURC_CHAINS.includes(empChain) ? empChain : 'BASE-SEPOLIA')
        : empChain) as CctpSourceChain

      // If a burn already exists and went through, don't re-burn — just reset to PENDING
      // so the settle route retries the mint (handles PAYMASTER / ESTIMATION_ERROR cases).
      if (entry.cctpBurnCircleId) {
        const { state } = await checkTransaction(entry.cctpBurnCircleId)
        if (state !== 'FAILED' && state !== 'CANCELLED') {
          await db.payrollEntry.update({
            where: { id: entry.id },
            data:  { status: 'PENDING', errorMessage: null },
          })
          return { entryId: entry.id, txHash: null, asyncCctp: true as const }
        }
      }

      // Clear stale CCTP metadata from previous failed attempt before fresh burn
      await db.payrollEntry.update({
        where: { id: entry.id },
        data:  { cctpBurnCircleId: null, burnTxHash: null, srcDomain: null, receiverWalletId: null, destTransmitter: null, errorMessage: null },
      })

      const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain)
      const burn = await cctpBurnFast({
        sourceChain:      'BASE-SEPOLIA',
        sourceWalletId:   baseWalletId,
        destChain,
        destWalletId,
        arcWalletId:      wallet.circleWalletId,
        recipientAddress: wallet.walletAddress,
        amount:           entry.amount,
        token:            empToken,
      })

      await db.payrollEntry.update({
        where: { id: entry.id },
        data:  {
          status:           'PENDING',
          cctpBurnCircleId: burn.burnCircleTxId,
          srcDomain:        burn.srcDomain,
          receiverWalletId: burn.receiverWalletId,
          destTransmitter:  burn.destTransmitter,
        },
      })
      return { entryId: entry.id, txHash: null, asyncCctp: true as const }
    }),
  )

  let completed    = 0
  let failed       = 0
  let asyncPending = 0

  for (let i = 0; i < results.length; i++) {
    const result  = results[i]
    const entryId = failedEntries[i].id
    if (result.status === 'fulfilled') {
      if (result.value.asyncCctp) {
        asyncPending++
      } else if (!result.value.alreadyDone) {
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'COMPLETED' } })
        completed++
      } else {
        completed++ // already marked COMPLETED inside the map
      }
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'Unknown error'
      await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'FAILED', errorMessage: message } })
      failed++
    }
  }

  // Recompute from all entries so previously-completed ones count
  const allEntries     = await db.payrollEntry.findMany({ where: { payrollRunId: run.id } })
  const totalCompleted = allEntries.filter((e) => e.status === 'COMPLETED').length
  const totalFailed    = allEntries.filter((e) => e.status === 'FAILED').length
  const finalStatus    = asyncPending > 0
    ? 'PROCESSING'
    : totalFailed === 0 ? 'COMPLETED' : totalCompleted === 0 ? 'FAILED' : 'PARTIAL'
  await db.payrollRun.update({ where: { id: run.id }, data: { status: finalStatus } })

  return NextResponse.json({ completed, failed, asyncPending, status: finalStatus })
}
