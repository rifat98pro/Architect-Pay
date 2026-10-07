import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances, sendUsdcPayment, getOrCreateChainWalletId, getWalletBalances } from '@/lib/circle'
import { logPayrollRunOnChain } from '@/lib/architect-pay-contract'
import { cctpTransfer } from '@/lib/cctp'
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

  // Get all chain USDC balances and compute funding plan
  const balances    = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))

  // Check USDC feasibility (only if there are USDC employees)
  if (usdcEmps.length > 0) {
    const plan = computeAggregatePlan(numericBals, totalWithFee)
    if (!plan.feasible) {
      const totalAvail = Object.values(numericBals).reduce((s, v) => s + v, 0)
      return NextResponse.json(
        { error: `Insufficient USDC. Need $${totalUsdcAmount.toFixed(2)} payroll + $${platformFee.toFixed(2)} fee = $${totalWithFee.toFixed(2)}, have $${totalAvail.toFixed(2)} USDC total.` },
        { status: 400 },
      )
    }
  }

  // Check EURC balance (only if there are EURC employees)
  if (eurcEmps.length > 0) {
    const arcBals  = await getWalletBalances(wallet.circleWalletId)
    const eurcBal  = parseFloat(arcBals.eurc)
    if (eurcBal < totalEurcAmount) {
      return NextResponse.json(
        { error: `Insufficient EURC. Need $${totalEurcAmount.toFixed(2)} EURC, have $${eurcBal.toFixed(2)} EURC on Arc.` },
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
    // Step 1: CCTP pull from non-Arc chains to user's own Arc wallet (if needed)
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
        const empChain   = (emp.preferredChain ?? 'ARC-TESTNET') as CctpSourceChain

        if (empToken === 'EURC') {
          // EURC supported only on Arc / ETH-SEPOLIA / BASE-SEPOLIA
          const destChain = EURC_CHAINS.includes(empChain) ? empChain : 'ARC-TESTNET'
          if (destChain !== 'ARC-TESTNET') {
            const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, destChain as CctpSourceChain)
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
            const result = await sendUsdcPayment({ fromWalletId: destWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
            return { entryId: entry.id, txHash: result.txHash }
          }
          const result = await sendUsdcPayment({ fromWalletId: wallet.circleWalletId, toAddress: emp.walletAddress, amount: entry.amount, token: 'EURC' })
          return { entryId: entry.id, txHash: result.txHash }
        }

        // USDC path — CCTP to preferred chain if not Arc
        let fromWalletId = wallet.circleWalletId
        if (empChain !== 'ARC-TESTNET') {
          const destWalletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId!, empChain)
          await cctpTransfer({
            sourceChain:      'ARC-TESTNET',
            sourceWalletId:   wallet.circleWalletId,
            destChain:        empChain,
            destWalletId,
            arcWalletId:      wallet.circleWalletId,
            recipientAddress: wallet.walletAddress,
            amount:           entry.amount,
          })
          fromWalletId = destWalletId
        }
        const result = await sendUsdcPayment({ fromWalletId, toAddress: emp.walletAddress, amount: entry.amount })
        return { entryId: entry.id, txHash: result.txHash }
      }),
    )

    let completed = 0
    let failed    = 0

    for (let i = 0; i < results.length; i++) {
      const result  = results[i]
      const entryId = run.entries[i].id
      if (result.status === 'fulfilled') {
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'COMPLETED', txHash: result.value.txHash } })
        completed++
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error'
        await db.payrollEntry.update({ where: { id: entryId }, data: { status: 'FAILED', errorMessage: message } })
        failed++
      }
    }

    const finalStatus = failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
    await db.payrollRun.update({ where: { id: run.id }, data: { status: finalStatus } })

    // Collect platform fee (best-effort — don't fail the run if fee transfer fails)
    if (completed > 0) {
      try {
        await sendUsdcPayment({
          fromWalletId: wallet.circleWalletId,
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
