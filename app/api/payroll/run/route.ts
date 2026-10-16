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

  // Check USDC feasibility — USDC employees are paid via CCTP burn from the hub.
  // Arc counts as a funding source again now that Circle has attributed the earlier
  // failures to a bad destinationDomain rather than the bundler.
  if (usdcEmps.length > 0) {
    const pullable = Object.values(numericBals).reduce((s, v) => s + v, 0)
    if (pullable < totalWithFee) {
      return NextResponse.json(
        { error: `Insufficient USDC. Need $${totalUsdcAmount.toFixed(2)} payroll + $${platformFee.toFixed(2)} fee = $${totalWithFee.toFixed(2)}, have $${pullable.toFixed(2)} across all chains.` },
        { status: 400 },
      )
    }
  }

  // Check EURC balances per wallet. EURC is paid directly from the wallet on the
  // employee's chain — Arc employees from the Arc wallet, everyone else from Base.
  // Payroll never bridges EURC, so an Arc shortfall cannot be covered from Base
  // or vice versa; each chain is its own budget.
  const eurcChainBals: Record<string, number> = {}

  // Employees whose chain's EURC balance can't cover them. They fail individually
  // with a clear reason rather than blocking the whole run — unlike USDC, each EURC
  // chain is its own budget, so one underfunded chain shouldn't stop everyone else.
  const underfundedEurc = new Map<string, string>()

  if (eurcEmps.length > 0) {
    const [arcEurc, baseEurc] = await Promise.all([
      getWalletBalances(wallet.circleWalletId).then((b) => parseFloat(b.eurc)).catch(() => 0),
      getWalletBalances(baseWalletId!).then((b) => parseFloat(b.eurc)).catch(() => 0),
    ])
    eurcChainBals['ARC-TESTNET']  = arcEurc
    eurcChainBals['BASE-SEPOLIA'] = baseEurc

    let arcLeft  = arcEurc
    let baseLeft = baseEurc
    for (const e of eurcEmps) {
      const onArc = (e.preferredChain ?? 'ARC-TESTNET') === 'ARC-TESTNET'
      const need  = parseFloat(e.salary)
      if (onArc) {
        if (arcLeft >= need) arcLeft -= need
        else underfundedEurc.set(e.id, `Insufficient EURC on Arc — €${need.toFixed(2)} needed, €${Math.max(arcLeft, 0).toFixed(2)} available. Deposit EURC to your Arc wallet.`)
      } else {
        if (baseLeft >= need) baseLeft -= need
        else underfundedEurc.set(e.id, `Insufficient EURC on Base — €${need.toFixed(2)} needed, €${Math.max(baseLeft, 0).toFixed(2)} available. Deposit EURC to your Base wallet.`)
      }
    }

    // Only block the run outright if no EURC employee at all can be paid.
    if (underfundedEurc.size === eurcEmps.length && usdcEmps.length === 0) {
      return NextResponse.json(
        { error: `Insufficient EURC. Need €${totalEurcAmount.toFixed(2)}, have €${arcEurc.toFixed(2)} on Arc and €${baseEurc.toFixed(2)} on Base. EURC is paid from the wallet on each employee's chain and cannot be bridged between them.` },
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

    // Chains we pay EURC from directly, without bridging. Employees stored on any
    // other chain fall back to Base. Bridging EURC further is configured but unproven,
    // so it is kept out of the payroll path until a real transfer settles.
    const EURC_CHAINS = ['ARC-TESTNET', 'BASE-SEPOLIA']

    // Step 2: Pay each employee — route by token + preferred chain
    const results = await Promise.allSettled(
      run.entries.map(async (entry) => {
        const emp        = employees.find((e) => e.id === entry.employeeId)!
        const empToken   = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
        const empChain   = (emp.preferredChain ?? 'BASE-SEPOLIA') as CctpSourceChain

        if (empToken === 'EURC') {
          const shortfall = underfundedEurc.get(emp.id)
          if (shortfall) throw new Error(shortfall)

          const destChain = EURC_CHAINS.includes(empChain) ? empChain : 'BASE-SEPOLIA'
          if (destChain === 'ARC-TESTNET') {
            const result = await sendUsdcPayment({ fromWalletId: wallet.circleWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
            await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined, paidChain: 'ARC-TESTNET' } })
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
              data: { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter, paidChain: destChain },
            })
            return { entryId: entry.id, txHash: null, asyncCctp: true as const }
          }
          const result = await sendUsdcPayment({ fromWalletId: baseWalletId!, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
          await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined, paidChain: 'BASE-SEPOLIA' } })
          return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
        }

        // USDC path — Base direct; everything else (including Arc) via CCTP burn from Base
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
            data: { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter, paidChain: empChain },
          })
          return { entryId: entry.id, txHash: null, asyncCctp: true as const }
        }
        const result = await sendUsdcPayment({ fromWalletId: baseWalletId!, toAddress: emp.walletAddress, amount: entry.amount })
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined, paidChain: 'BASE-SEPOLIA' } })
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
