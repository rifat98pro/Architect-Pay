import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { sendUsdcPayment, getOrCreateChainWalletId, checkTransaction, getWalletBalances } from '@/lib/circle'
import { cctpTransfer } from '@/lib/cctp'
import { type CctpSourceChain } from '@/lib/cctp-chains'

export const maxDuration = 300

const EURC_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA']

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

  await db.payrollRun.update({ where: { id: run.id }, data: { status: 'PROCESSING' } })

  const results = await Promise.allSettled(
    failedEntries.map(async (entry) => {
      const emp      = entry.employee
      const empToken = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
      const empChain = (emp.preferredChain ?? 'ARC-TESTNET') as CctpSourceChain

      // If Circle already processed this tx, verify before re-sending to prevent double-pay
      if (entry.circleTxId) {
        const { state, txHash } = await checkTransaction(entry.circleTxId)
        if (state === 'CONFIRMED' || state === 'COMPLETE') {
          // Tx went through — mark COMPLETED and skip re-send
          await db.payrollEntry.update({ where: { id: entry.id }, data: { status: 'COMPLETED', txHash: txHash ?? entry.txHash ?? undefined, errorMessage: null } })
          return { entryId: entry.id, txHash: txHash ?? null, alreadyCompleted: true }
        }
        if (state !== 'FAILED' && state !== 'CANCELLED') {
          // Still in-flight — don't retry yet
          throw new Error('Transaction still processing — please wait and try again shortly.')
        }
        // State is FAILED/CANCELLED → clear circleTxId and proceed with fresh payment
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: null, txHash: null } })
      }

      if (empToken === 'EURC') {
        const destChain = EURC_CHAINS.includes(empChain) ? empChain : 'ARC-TESTNET'
        if (destChain !== 'ARC-TESTNET') {
          const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain as CctpSourceChain)
          // Skip CCTP if funds already arrived from a prior attempt (prevents double-burn)
          const destBal = await getWalletBalances(destWalletId)
          if (parseFloat(destBal.eurc) < parseFloat(entry.amount)) {
            await cctpTransfer({
              sourceChain:      'ARC-TESTNET',
              sourceWalletId:   wallet.circleWalletId,
              destChain:        destChain as CctpSourceChain,
              destWalletId,
              arcWalletId:      wallet.circleWalletId,
              recipientAddress: wallet.walletAddress,
              amount:           entry.amount,
              token:            'EURC',
            })
          }
          const result = await sendUsdcPayment({ fromWalletId: destWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
          await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
          return { entryId: entry.id, txHash: result.txHash }
        }
        const result = await sendUsdcPayment({ fromWalletId: wallet.circleWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
        return { entryId: entry.id, txHash: result.txHash }
      }

      let fromWalletId = wallet.circleWalletId
      if (empChain !== 'ARC-TESTNET') {
        const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, empChain)
        // Skip CCTP if funds already arrived from a prior attempt (prevents double-burn)
        const destBal = await getWalletBalances(destWalletId)
        if (parseFloat(destBal.usdc) < parseFloat(entry.amount)) {
          await cctpTransfer({
            sourceChain:      'ARC-TESTNET',
            sourceWalletId:   wallet.circleWalletId,
            destChain:        empChain,
            destWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
        }
        fromWalletId = destWalletId
      }
      const result = await sendUsdcPayment({ fromWalletId, toAddress: emp.walletAddress, amount: entry.amount })
      await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
      return { entryId: entry.id, txHash: result.txHash }
    }),
  )

  let completed = 0
  let failed    = 0

  for (let i = 0; i < results.length; i++) {
    const result  = results[i]
    const entryId = failedEntries[i].id
    if (result.status === 'fulfilled') {
      if (!result.value.alreadyCompleted) {
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'COMPLETED', txHash: result.value.txHash, errorMessage: null } })
      }
      completed++
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'Unknown error'
      await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'FAILED', errorMessage: message } })
      failed++
    }
  }

  // Recompute status from all entries (not just the retried ones)
  const allEntries    = await db.payrollEntry.findMany({ where: { payrollRunId: run.id } })
  const totalCompleted = allEntries.filter((e) => e.status === 'COMPLETED').length
  const totalFailed    = allEntries.filter((e) => e.status === 'FAILED').length
  const finalStatus    = totalFailed === 0 ? 'COMPLETED' : totalCompleted === 0 ? 'FAILED' : 'PARTIAL'
  await db.payrollRun.update({ where: { id: run.id }, data: { status: finalStatus } })

  return NextResponse.json({ completed, failed, status: finalStatus })
}
