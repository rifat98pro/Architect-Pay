import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances, sendUsdcPayment, getOrCreateChainWalletId, getWalletBalances } from '@/lib/circle'
import { logPayrollRunOnChain } from '@/lib/architect-pay-contract'
import { cctpTransfer, cctpBurnFast } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'
import { computeAggregatePlan } from '@/lib/aggregate'
import { calcFee, FEE_RECIPIENT } from '@/lib/fees'

export const maxDuration = 300

export async function POST(req: Request) {
  // Allow cron-triggered calls with x-user-id header + cron secret
  const authHeader = req.headers.get('authorization')
  const cronUserId = req.headers.get('x-user-id')
  const isCron     = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}` && !!cronUserId

  const user = isCron
    ? await db.user.findUnique({ where: { id: cronUserId! }, select: { id: true } })
    : await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body       = await req.json().catch(() => ({}))
  const businessId = body.businessId as string | undefined

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  // Block duplicate concurrent runs — but allow a new run if the existing one's
  // only pending entries are async CCTP burns (they have isolated receiver wallets
  // and won't interfere with a fresh run; cron/settle handles them independently).
  const activeRun = await db.payrollRun.findFirst({
    where:   { userId: user.id, status: 'PROCESSING', ...(businessId ? { businessId } : {}) },
    include: { entries: { where: { status: 'PENDING' } } },
  })
  if (activeRun) {
    const hasBlockingEntry = activeRun.entries.some((e) => !e.cctpBurnCircleId)
    if (hasBlockingEntry) {
      return NextResponse.json({ error: 'A payroll run is already in progress. Please wait for it to complete.' }, { status: 409 })
    }
  }

  const employees = await db.employee.findMany({
    where: { userId: user.id, active: true, ...(businessId ? { businessId } : {}) },
  })
  if (employees.length === 0) {
    return NextResponse.json({ error: 'No active employees' }, { status: 400 })
  }

  const usdcEmps      = employees.filter((e) => (e.preferredToken ?? 'USDC') === 'USDC')
  const eurcEmps      = employees.filter((e) => e.preferredToken === 'EURC')

  const totalUsdcAmount = usdcEmps.reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalEurcAmount = eurcEmps.reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalAmount   = totalUsdcAmount + totalEurcAmount
  const platformFee   = calcFee(totalUsdcAmount)
  const totalWithFee  = totalUsdcAmount + platformFee

  // Build chain wallet ID map
  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  // Get or create Base wallet — payroll hub chain
  let baseWalletId = chainWalletIds['BASE-SEPOLIA']
  if (!baseWalletId) {
    if (!wallet.walletSetId) return NextResponse.json({ error: 'No wallet set configured' }, { status: 400 })
    baseWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, 'BASE-SEPOLIA')
  }

  // Get all chain USDC balances and compute funding plan
  const balances    = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))

  // Check USDC feasibility with correct per-wallet accounting:
  // Arc employees are paid directly from Arc wallet (Arc can't be a CCTP source).
  // All other employees are burned from Base (funded by Base + pullable chain wallets).
  if (usdcEmps.length > 0) {
    const arcUsdcEmps  = usdcEmps.filter((e) => (e.preferredChain ?? 'ARC-TESTNET') === 'ARC-TESTNET')
    const hubUsdcEmps  = usdcEmps.filter((e) => (e.preferredChain ?? 'ARC-TESTNET') !== 'ARC-TESTNET')
    const arcNeeded    = arcUsdcEmps.reduce((s, e) => s + parseFloat(e.salary), 0)
    const baseNeeded   = hubUsdcEmps.reduce((s, e) => s + parseFloat(e.salary), 0) + platformFee
    const arcBalance   = numericBals['ARC-TESTNET'] ?? 0
    // Base + any CCTP-pullable chain (everything except Arc)
    const pullable     = Object.entries(numericBals)
      .filter(([k]) => k !== 'ARC-TESTNET')
      .reduce((s, [, v]) => s + v, 0)

    if (arcBalance < arcNeeded) {
      return NextResponse.json(
        { error: `Insufficient USDC on Arc for Arc employees. Need $${arcNeeded.toFixed(2)}, have $${arcBalance.toFixed(2)} on Arc.` },
        { status: 400 },
      )
    }
    if (pullable < baseNeeded) {
      return NextResponse.json(
        { error: `Insufficient USDC for cross-chain payroll. Need $${baseNeeded.toFixed(2)} (payroll + fee), have $${pullable.toFixed(2)} across Base and other chains.` },
        { status: 400 },
      )
    }
  }

  // Check EURC balance — Base (EURC payroll sources from Base)
  const eurcChainBals: Record<string, number> = {}

  if (eurcEmps.length > 0) {
    const baseEurc = parseFloat((await getWalletBalances(baseWalletId!)).eurc)
    eurcChainBals['BASE-SEPOLIA'] = baseEurc
    if (baseEurc < totalEurcAmount) {
      return NextResponse.json(
        { error: `Insufficient EURC on Base. Need €${totalEurcAmount.toFixed(2)}, have €${baseEurc.toFixed(2)} on Base. Please deposit EURC to your Base wallet before running payroll.` },
        { status: 400 },
      )
    }
  }

  const plan = usdcEmps.length > 0 ? computeAggregatePlan(numericBals, totalWithFee) : { feasible: true, plan: [] }

  // Create payroll run record
  const run = await db.payrollRun.create({
    data: {
      userId:      user.id,
      businessId:  businessId ?? null,
      status:      'PROCESSING',
      totalAmount: totalAmount.toFixed(6),
      entries: {
        create: employees.map((e) => ({
          employeeId: e.id,
          amount:     e.salary,
          status:     'PENDING',
        })),
      },
    },
    include: { entries: true },
  })

  try {
    // Step 1: CCTP pull from non-Base chains to user's own Base wallet (if needed)
    const cctpEntries = plan.plan.filter((e) => e.isCctp)
    if (cctpEntries.length > 0) {
      await Promise.all(
        cctpEntries.map(async (entry) => {
          const chain = entry.chain as CctpSourceChain
          let sourceWalletId = chainWalletIds[chain]
          if (!sourceWalletId) {
            if (!wallet.walletSetId) throw new Error(`No wallet set for chain ${chain}`)
            sourceWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, chain)
          }
          await cctpTransfer({
            sourceChain:      chain,
            sourceWalletId,
            destChain:        'BASE-SEPOLIA',
            destWalletId:     baseWalletId!,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
        }),
      )
    }

    const EURC_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA']

    // Step 2: Pay each employee — route by token + preferred chain
    const results = await Promise.allSettled(
      run.entries.map(async (entry) => {
        const emp        = employees.find((e) => e.id === entry.employeeId)!
        const empToken   = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
        const empChain   = (emp.preferredChain ?? 'BASE-SEPOLIA') as CctpSourceChain

        if (empToken === 'EURC') {
          // EURC supported only on Arc / ETH-SEPOLIA / BASE-SEPOLIA
          const destChain = EURC_CHAINS.includes(empChain) ? empChain : 'BASE-SEPOLIA'
          if (destChain === 'ARC-TESTNET') {
            const result = await sendUsdcPayment({ fromWalletId: wallet.circleWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
            await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
            return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
          }
          if (destChain !== 'BASE-SEPOLIA') {
            // Fire burn async — iris relay settled by client polling
            const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain as CctpSourceChain)
            const burn = await cctpBurnFast({
              sourceChain:      'BASE-SEPOLIA',
              sourceWalletId:   baseWalletId!,
              destChain:        destChain as CctpSourceChain,
              destWalletId,
              arcWalletId:      wallet.circleWalletId,
              recipientAddress: wallet.walletAddress,
              amount:           entry.amount,
              token:            'EURC',
            })
            await db.payrollEntry.update({
              where: { id: entry.id },
              data: { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter },
            })
            return { entryId: entry.id, txHash: null, asyncCctp: true as const }
          }
          const result = await sendUsdcPayment({ fromWalletId: baseWalletId!, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
          await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
          return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
        }

        // USDC path — Arc-to-Arc direct; cross-chain via Base; Base direct
        if (empChain === 'ARC-TESTNET') {
          const result = await sendUsdcPayment({ fromWalletId: wallet.circleWalletId, toAddress: emp.walletAddress, amount: entry.amount })
          await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
          return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
        }
        if (empChain !== 'BASE-SEPOLIA') {
          const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, empChain)
          const burn = await cctpBurnFast({
            sourceChain:      'BASE-SEPOLIA',
            sourceWalletId:   baseWalletId!,
            destChain:        empChain,
            destWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
          await db.payrollEntry.update({
            where: { id: entry.id },
            data: { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter },
          })
          return { entryId: entry.id, txHash: null, asyncCctp: true as const }
        }
        const result = await sendUsdcPayment({ fromWalletId: baseWalletId!, toAddress: emp.walletAddress, amount: entry.amount })
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined } })
        return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
      }),
    )

    let completed  = 0
    let failed     = 0
    let asyncPending = 0

    for (let i = 0; i < results.length; i++) {
      const result  = results[i]
      const entryId = run.entries[i].id
      if (result.status === 'fulfilled' && result.value.asyncCctp) {
        asyncPending++ // CCTP burn submitted — mint+send happens via client polling
      } else if (result.status === 'fulfilled') {
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'COMPLETED', txHash: result.value.txHash } })
        completed++
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error'
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'FAILED', errorMessage: message } })
        failed++
      }
    }

    // Keep PROCESSING if any entries still settling via CCTP
    const finalStatus = asyncPending > 0
      ? 'PROCESSING'
      : failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
    await db.payrollRun.update({ where: { id: run.id }, data: { status: finalStatus } })

    // Collect platform fee (best-effort — don't fail the run if fee transfer fails)
    // Fire even for async payrolls — burns are already submitted so the cost is real
    if (completed > 0 || asyncPending > 0) {
      try {
        await sendUsdcPayment({
          fromWalletId: baseWalletId!,
          toAddress:    FEE_RECIPIENT,
          amount:       platformFee.toFixed(6),
        })
      } catch (feeErr) {
        console.error('[payroll] fee transfer failed:', feeErr)
      }
    }

    if (completed > 0) logPayrollRunOnChain(wallet.circleWalletId, totalAmount.toFixed(6), completed)

    return NextResponse.json({ runId: run.id, completed, failed, status: finalStatus })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await db.payrollRun.update({ where: { id: run.id }, data: { status: 'FAILED' } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
