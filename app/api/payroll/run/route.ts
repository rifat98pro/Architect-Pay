import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances, sendUsdcPayment, getOrCreateChainWalletId, getWalletBalances } from '@/lib/circle'
import { logPayrollRunOnChain } from '@/lib/architect-pay-contract'
import { cctpTransfer, cctpBurnFast } from '@/lib/cctp'
import { CCTP_SOURCE_CHAINS, EURC_CCTP_CHAINS, HUB_CHAIN, type CctpSourceChain } from '@/lib/cctp-chains'
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
  // The fee is per cross-chain payout, not per run: a payroll that bridges to six
  // chains costs six times what one does. Employees paid on the hub are a local
  // send and carry nothing. Each payout takes its own minimum, so ten small
  // cross-chain salaries are ten minimums rather than one.
  const isCrossChainEmp = (e: { preferredChain: string | null }) =>
    (e.preferredChain ?? HUB_CHAIN) !== HUB_CHAIN

  const usdcFee = usdcEmps.filter(isCrossChainEmp)
    .reduce((sum, e) => sum + calcFee(parseFloat(e.salary)), 0)
  const eurcFee = eurcEmps.filter(isCrossChainEmp)
    .reduce((sum, e) => sum + calcFee(parseFloat(e.salary)), 0)

  const platformFee   = usdcFee
  const totalWithFee  = totalUsdcAmount + usdcFee

  // Build chain wallet ID map
  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  // Resolve the hub wallet — every cross-chain payout is burned from here
  let hubWalletId = HUB_CHAIN === 'ARC-TESTNET' ? wallet.circleWalletId : chainWalletIds[HUB_CHAIN]
  if (!hubWalletId) {
    if (!wallet.walletSetId) return NextResponse.json({ error: 'No wallet set configured' }, { status: 400 })
    hubWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, HUB_CHAIN)
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

  // EURC is paid out of the hub, exactly like USDC: employees on the hub are sent
  // directly, everyone else is bridged from it. Arc is the only source CCTPx quotes
  // at a zero fee, so paying from anywhere else would cost a native-token fee that
  // gas-sponsored wallets cannot pay.
  //
  // Employees the hub can't cover fail individually with a clear reason rather than
  // blocking the whole run.
  const underfundedEurc = new Map<string, string>()

  if (eurcEmps.length > 0) {
    const hubEurc = await getWalletBalances(hubWalletId!).then((b) => parseFloat(b.eurc)).catch(() => 0)

    // What the user sees as their balance is the total across chains. If that total
    // covers payroll but the hub doesn't yet, the sweep simply hasn't caught up —
    // which is a wait, not a shortfall, and the message has to say so.
    const offHubEurc = (await Promise.all(
      EURC_CCTP_CHAINS
        .filter((c) => c !== HUB_CHAIN)
        .map((c) => {
          const id = chainWalletIds[c as CctpSourceChain]
          return id ? getWalletBalances(id).then((b) => parseFloat(b.eurc)).catch(() => 0) : Promise.resolve(0)
        }),
    )).reduce((s, v) => s + v, 0)

    // Reserve the EURC fee before budgeting salaries, or the last employee is paid
    // and the fee transfer then fails on an empty hub.
    let left = hubEurc - eurcFee
    for (const e of eurcEmps) {
      const need = parseFloat(e.salary)
      if (left >= need) { left -= need; continue }
      underfundedEurc.set(
        e.id,
        offHubEurc > 0
          ? `€${need.toFixed(2)} needed but only €${Math.max(left, 0).toFixed(2)} has finished settling. €${offHubEurc.toFixed(2)} is still arriving — try again in a few minutes.`
          : `Insufficient EURC — €${need.toFixed(2)} needed, €${Math.max(left, 0).toFixed(2)} available.`,
      )
    }

    // Only block the run outright if no EURC employee at all can be paid.
    if (underfundedEurc.size === eurcEmps.length && usdcEmps.length === 0) {
      return NextResponse.json(
        {
          error: offHubEurc > 0
            ? `EURC is still settling. €${totalEurcAmount.toFixed(2)} is needed, €${hubEurc.toFixed(2)} has settled and €${offHubEurc.toFixed(2)} is still arriving — try again in a few minutes.`
            : `Insufficient EURC. Need €${totalEurcAmount.toFixed(2)}, have €${hubEurc.toFixed(2)}.`,
        },
        { status: 400 },
      )
    }
  }

  const plan = usdcEmps.length > 0 ? computeAggregatePlan(numericBals, totalWithFee, HUB_CHAIN) : { feasible: true, plan: [] }

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
    // Step 1: CCTP pull from other chains into the user's own hub wallet (if needed)
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
            destChain:        HUB_CHAIN,
            destWalletId:     hubWalletId!,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
        }),
      )
    }


    // Step 2: Pay each employee — route by token + preferred chain
    const results = await Promise.allSettled(
      run.entries.map(async (entry) => {
        const emp        = employees.find((e) => e.id === entry.employeeId)!
        const empToken   = (emp.preferredToken ?? 'USDC') as 'USDC' | 'EURC'
        // An employee saved against a chain we no longer route on is paid on the
        // hub rather than failing. Their stored preference predates the chain being
        // retired, and one stale row must not take down the whole run.
        const storedChain = emp.preferredChain ?? HUB_CHAIN
        const empChain    = ((CCTP_SOURCE_CHAINS as readonly string[]).includes(storedChain)
          ? storedChain
          : HUB_CHAIN) as CctpSourceChain

        if (empToken === 'EURC') {
          const shortfall = underfundedEurc.get(emp.id)
          if (shortfall) throw new Error(shortfall)

          // EURC exists on only three chains, so an employee who prefers any other
          // one is paid on the hub — there is no EURC on their chain to receive.
          const payChain = (EURC_CCTP_CHAINS as readonly string[]).includes(empChain)
            ? empChain
            : HUB_CHAIN

          if (payChain !== HUB_CHAIN) {
            // Bridge from the hub straight to the employee, same shape as the USDC
            // path: cron/settle mints and pays out once the attestation lands.
            const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, payChain as CctpSourceChain)
            const burn = await cctpBurnFast({
              sourceChain:      HUB_CHAIN,
              sourceWalletId:   hubWalletId!,
              destChain:        payChain as CctpSourceChain,
              destWalletId,
              arcWalletId:      wallet.circleWalletId,
              recipientAddress: wallet.walletAddress,
              amount:           entry.amount,
              token:            'EURC',
            })
            await db.payrollEntry.update({
              where: { id: entry.id },
              data: { cctpBurnCircleId: burn.burnCircleTxId, srcDomain: burn.srcDomain, receiverWalletId: burn.receiverWalletId, destTransmitter: burn.destTransmitter, paidChain: payChain },
            })
            return { entryId: entry.id, txHash: null, asyncCctp: true as const }
          }

          const result = await sendUsdcPayment({ fromWalletId: hubWalletId!, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
          await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined, paidChain: payChain } })
          return { entryId: entry.id, txHash: result.txHash, asyncCctp: false as const }
        }

        // USDC path — Base direct; everything else (including Arc) via CCTP burn from Base
        if (empChain !== HUB_CHAIN) {
          const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, empChain)
          const burn = await cctpBurnFast({
            sourceChain:      HUB_CHAIN,
            sourceWalletId:   hubWalletId!,
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
        const result = await sendUsdcPayment({ fromWalletId: hubWalletId!, toAddress: emp.walletAddress, amount: entry.amount })
        await db.payrollEntry.update({ where: { id: entry.id }, data: { circleTxId: result.id, txHash: result.txHash ?? undefined, paidChain: HUB_CHAIN } })
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

    // Collect platform fees (best-effort — don't fail the run if a transfer fails).
    // Fire even for async payrolls: the burns are already submitted, so the cost is
    // real whether or not the mints have landed. USDC and EURC are charged
    // separately because a euro payroll cannot be billed out of a dollar balance.
    if (completed > 0 || asyncPending > 0) {
      for (const [token, fee] of [['USDC', usdcFee], ['EURC', eurcFee]] as const) {
        if (fee <= 0) continue
        try {
          await sendUsdcPayment({
            fromWalletId: hubWalletId!,
            toAddress:    FEE_RECIPIENT,
            amount:       fee.toFixed(6),
            token,
          })
        } catch (feeErr) {
          console.error(`[payroll] ${token} fee transfer failed:`, feeErr)
        }
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
