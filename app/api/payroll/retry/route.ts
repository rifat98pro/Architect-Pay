import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { sendUsdcPayment, getOrCreateChainWalletId, checkTransaction } from '@/lib/circle'
import { cctpBurnFast } from '@/lib/cctp'
import { EURC_CCTP_CHAINS, HUB_CHAIN, type CctpSourceChain } from '@/lib/cctp-chains'

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

  const hubWalletId = HUB_CHAIN === 'ARC-TESTNET'
    ? wallet.circleWalletId
    : wallet.chainWallets.find((cw) => cw.chain === HUB_CHAIN)?.circleWalletId
      ?? await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, HUB_CHAIN)

  await db.payrollRun.update({ where: { id: run.id }, data: { status: 'PROCESSING' } })

  const internalWallets = await db.wallet.findMany({
    where:   { walletAddress: { in: failedEntries.map((e) => e.employee.walletAddress) } },
    select:  { walletAddress: true },
  })
  const internalWalletSet = new Set(internalWallets.map((w) => w.walletAddress.toLowerCase()))

  const results = await Promise.allSettled(
    failedEntries.map(async (entry) => {
      const emp        = entry.employee
      const empToken   = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
      const isInternal = internalWalletSet.has(emp.walletAddress.toLowerCase())
      const empChain   = (isInternal ? HUB_CHAIN : (emp.preferredChain ?? HUB_CHAIN)) as CctpSourceChain

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
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null, paidChain: entry.paidChain ?? empChain },
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

      // EURC is paid out of the hub like everything else: direct when the employee
      // is on it, bridged from it otherwise. EURC exists on only three chains, so an
      // employee preferring any other one is paid on the hub.
      if (empToken === 'EURC') {
        const payChain = (EURC_CCTP_CHAINS as readonly string[]).includes(empChain)
          ? empChain
          : HUB_CHAIN

        if (payChain !== HUB_CHAIN) {
          const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, payChain as CctpSourceChain)
          const burn = await cctpBurnFast({
            sourceChain:      HUB_CHAIN,
            sourceWalletId:   hubWalletId,
            destChain:        payChain as CctpSourceChain,
            destWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
            token:            'EURC',
          })
          await db.payrollEntry.update({
            where: { id: entry.id },
            data:  { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter, errorMessage: null, paidChain: payChain },
          })
          return { entryId: entry.id, txHash: null, asyncCctp: true as const }
        }

        const result = await sendUsdcPayment({
          fromWalletId: hubWalletId,
          toAddress:    emp.walletAddress,
          amount:       entry.amount,
          token:        'EURC',
        })
        await db.payrollEntry.update({
          where: { id: entry.id },
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null, paidChain: payChain },
        })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }

      // USDC already sitting on the hub — send immediately, no bridge needed
      if (empChain === HUB_CHAIN) {
        const result = await sendUsdcPayment({
          fromWalletId: hubWalletId,
          toAddress:    emp.walletAddress,
          amount:       entry.amount,
          token:        empToken,
        })
        await db.payrollEntry.update({
          where: { id: entry.id },
          data:  { circleTxId: result.id, txHash: result.txHash ?? undefined, errorMessage: null, paidChain: HUB_CHAIN },
        })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }

      // Cross-chain USDC: fire async burn from the hub (settle route handles mint+send)
      const destChain = empChain as CctpSourceChain

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
        sourceChain:      HUB_CHAIN,
        sourceWalletId:   hubWalletId,
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
          paidChain:        destChain,
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
