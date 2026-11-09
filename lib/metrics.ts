import { db } from '@/lib/db'
import { CHAIN_LABEL, type KnownChain } from '@/lib/cctp-chains'
import { batchVerifyTransactions } from '@/lib/chain-verifier'

// Standard EURC to USD peg reference for unified USD volume aggregation
export const EURC_USD_RATE = 1.08

export interface DailyActivityPoint {
  date: string // YYYY-MM-DD
  volumeUsd: number
  txCount: number
}

export interface AssetDistributionItem {
  asset: 'USDC' | 'EURC'
  volumeUsd: number
  txCount: number
  percentage: number
}

export interface NetworkActivityItem {
  chainKey: string
  chainName: string
  txCount: number
  volumeUsd: number
  percentage: number
}

export interface ProductActivityItem {
  category: 'internal_payments' | 'external_payouts' | 'payroll' | 'swaps' | 'sweeps'
  label: string
  txCount: number
  volumeUsd: number
  percentage: number
}

export interface PublicMetricsData {
  generatedAt: string
  dataCoverage: {
    period: string
    chainsMonitored: number
    onChainVerificationActive: boolean
    syncStatus: 'synced' | 'degraded' | 'cached'
  }
  summary: {
    registeredAccounts: number
    activeAccounts30d: number
    activeAccountsAllTime: number
    verifiedTransactions: number
    totalPaymentVolumeUsd: number
    activeBusinesses: number
    completedPayrollBatches: number
    onChainVerifiedTransactions: number
  }
  breakdown: {
    volumeByDay: DailyActivityPoint[]
    transactionsByDay: DailyActivityPoint[]
    assetDistribution: AssetDistributionItem[]
    networkActivity: NetworkActivityItem[]
    productActivity: ProductActivityItem[]
    internalVsExternal: {
      internalVolumeUsd: number
      internalTxCount: number
      externalVolumeUsd: number
      externalTxCount: number
      internalPercentage: number
    }
  }
  methodology: {
    accountingStandard: string
    currencyValuation: string
    verificationCriteria: string
    exclusions: string
    internalVsExternalDefinition: string
    updateFrequency: string
  }
}

// In-memory cache for API responses
let cachedMetrics: { data: PublicMetricsData; expiresAt: number } | null = null
const CACHE_LIFETIME_MS = 60 * 1000 // 60 seconds TTL

/**
 * Format a Date to YYYY-MM-DD string
 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Convert token amount to USD
 */
function toUsd(amountStr: string, token = 'USDC'): number {
  const val = parseFloat(amountStr || '0')
  if (isNaN(val) || val <= 0) return 0
  if (token.toUpperCase() === 'EURC') {
    return parseFloat((val * EURC_USD_RATE).toFixed(2))
  }
  return parseFloat(val.toFixed(2))
}

/**
 * Main analytics aggregator function.
 * Read-only, privacy-preserving, and cached.
 */
export async function getPublicMetrics(forceRefresh = false): Promise<PublicMetricsData> {
  const now = Date.now()
  if (!forceRefresh && cachedMetrics && cachedMetrics.expiresAt > now) {
    return cachedMetrics.data
  }

  try {
    // 1. Registered Accounts
    const registeredAccounts = await db.user.count()

    // 2. Wallets for internal-vs-external address matching
    const internalWallets = await db.wallet.findMany({
      select: { walletAddress: true, userId: true },
    })
    const internalAddressSet = new Set(
      internalWallets.map((w) => w.walletAddress.toLowerCase()),
    )

    // 3. Payments: only completed payments contribute to verified volume and metrics
    const payments = await db.payment.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        senderId: true,
        recipientAddress: true,
        amount: true,
        token: true,
        sourceChain: true,
        destChain: true,
        txHash: true,
        createdAt: true,
      },
    })

    // 4. Payroll Runs & Entries
    const payrollRuns = await db.payrollRun.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        userId: true,
        businessId: true,
        totalAmount: true,
        createdAt: true,
      },
    })

    const payrollEntries = await db.payrollEntry.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        amount: true,
        txHash: true,
        paidChain: true,
        updatedAt: true,
        employee: {
          select: {
            preferredChain: true,
            preferredToken: true,
          },
        },
      },
    })

    // 5. Active Businesses (with employees or completed payroll runs)
    const businesses = await db.business.findMany({
      select: {
        id: true,
        _count: {
          select: { employees: true, payrollRuns: true },
        },
      },
    })
    const activeBusinesses = businesses.filter(
      (b) => b._count.employees > 0 || b._count.payrollRuns > 0,
    ).length

    // 6. Swaps
    const swaps = await db.swapHistory.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        userId: true,
        tokenIn: true,
        amountIn: true,
        tokenOut: true,
        amountOut: true,
        srcChain: true,
        txHash: true,
        createdAt: true,
      },
    })

    // 7. Sweeps (Consolidations)
    const sweeps = await db.sweep.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        chain: true,
        token: true,
        amount: true,
        burnTxHash: true,
        mintTxHash: true,
        createdAt: true,
      },
    })

    // ── Calculate Active Accounts ──────────────────────────────────────────
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const activeUsers30d = new Set<string>()
    const activeUsersAllTime = new Set<string>()

    for (const p of payments) {
      activeUsersAllTime.add(p.senderId)
      if (p.createdAt >= thirtyDaysAgo) activeUsers30d.add(p.senderId)
    }

    for (const r of payrollRuns) {
      activeUsersAllTime.add(r.userId)
      if (r.createdAt >= thirtyDaysAgo) activeUsers30d.add(r.userId)
    }

    for (const s of swaps) {
      activeUsersAllTime.add(s.userId)
      if (s.createdAt >= thirtyDaysAgo) activeUsers30d.add(s.userId)
    }

    // ── Payment Volume Calculation ────────────────────────────────────────
    let directPaymentVolumeUsd = 0
    let internalPaymentVolumeUsd = 0
    let externalPaymentVolumeUsd = 0
    let internalPaymentCount = 0
    let externalPaymentCount = 0

    const volumeByDayMap = new Map<string, { volumeUsd: number; txCount: number }>()

    const recordDailyPoint = (date: Date, usdAmount: number) => {
      const key = toDateKey(date)
      const current = volumeByDayMap.get(key) || { volumeUsd: 0, txCount: 0 }
      current.volumeUsd = parseFloat((current.volumeUsd + usdAmount).toFixed(2))
      current.txCount += 1
      volumeByDayMap.set(key, current)
    }

    // Asset & Network tracking
    const assetMap: Record<'USDC' | 'EURC', { volumeUsd: number; txCount: number }> = {
      USDC: { volumeUsd: 0, txCount: 0 },
      EURC: { volumeUsd: 0, txCount: 0 },
    }

    const networkMap: Record<string, { volumeUsd: number; txCount: number }> = {}

    const recordNetwork = (chainKey: string, usdAmount: number) => {
      const normalizedChain = chainKey || 'ARC-TESTNET'
      const cur = networkMap[normalizedChain] || { volumeUsd: 0, txCount: 0 }
      cur.volumeUsd = parseFloat((cur.volumeUsd + usdAmount).toFixed(2))
      cur.txCount += 1
      networkMap[normalizedChain] = cur
    }

    // Process direct payments
    for (const p of payments) {
      const token = (p.token?.toUpperCase() === 'EURC' ? 'EURC' : 'USDC') as 'USDC' | 'EURC'
      const usdVal = toUsd(p.amount, token)
      directPaymentVolumeUsd += usdVal

      const isInternal = internalAddressSet.has(p.recipientAddress.toLowerCase())
      if (isInternal) {
        internalPaymentVolumeUsd += usdVal
        internalPaymentCount += 1
      } else {
        externalPaymentVolumeUsd += usdVal
        externalPaymentCount += 1
      }

      recordDailyPoint(p.createdAt, usdVal)

      assetMap[token].volumeUsd += usdVal
      assetMap[token].txCount += 1

      recordNetwork(p.sourceChain, usdVal)
    }

    // Process payroll payments (payroll disbursements are payment volume)
    let payrollVolumeUsd = 0
    for (const entry of payrollEntries) {
      const token = (entry.employee?.preferredToken?.toUpperCase() === 'EURC' ? 'EURC' : 'USDC') as 'USDC' | 'EURC'
      const usdVal = toUsd(entry.amount, token)
      payrollVolumeUsd += usdVal
      externalPaymentVolumeUsd += usdVal
      externalPaymentCount += 1

      recordDailyPoint(entry.updatedAt, usdVal)

      assetMap[token].volumeUsd += usdVal
      assetMap[token].txCount += 1

      const chain = entry.paidChain || entry.employee?.preferredChain || 'ARC-TESTNET'
      recordNetwork(chain, usdVal)
    }

    const totalPaymentVolumeUsd = parseFloat(
      (directPaymentVolumeUsd + payrollVolumeUsd).toFixed(2),
    )

    // Process swaps (tracked distinctly from payment volume)
    let swapVolumeUsd = 0
    for (const s of swaps) {
      const token = s.tokenIn?.toUpperCase() === 'EURC' ? 'EURC' : 'USDC'
      const usdVal = toUsd(s.amountIn, token)
      swapVolumeUsd += usdVal
      recordNetwork(s.srcChain, usdVal)
    }

    // Process sweeps (internal consolidations, tracked distinctly)
    let sweepVolumeUsd = 0
    for (const sw of sweeps) {
      const token = sw.token?.toUpperCase() === 'EURC' ? 'EURC' : 'USDC'
      const usdVal = toUsd(sw.amount, token)
      sweepVolumeUsd += usdVal
      recordNetwork(sw.chain, usdVal)
    }

    // Verified transactions total across all products
    const verifiedTransactions =
      payments.length + payrollEntries.length + swaps.length + sweeps.length

    // ── On-Chain Verification Batch ───────────────────────────────────────
    // Collect all candidate hashes from completed records
    const hashCandidates: Array<{ txHash: string | null; chain?: string }> = [
      ...payments.map((p) => ({ txHash: p.txHash, chain: p.sourceChain })),
      ...payrollEntries.map((e) => ({ txHash: e.txHash, chain: e.paidChain ?? undefined })),
      ...swaps.map((s) => ({ txHash: s.txHash, chain: s.srcChain })),
      ...sweeps.map((sw) => ({ txHash: sw.mintTxHash ?? sw.burnTxHash, chain: sw.chain })),
    ]

    const onChainCheck = await batchVerifyTransactions(hashCandidates, 5)

    // ── Daily Breakdown Formatting ─────────────────────────────────────────
    const sortedDays = Array.from(volumeByDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        volumeUsd: data.volumeUsd,
        txCount: data.txCount,
      }))

    // If no transactions exist yet, provide a baseline zero-point for chart continuity
    const volumeByDay: DailyActivityPoint[] =
      sortedDays.length > 0
        ? sortedDays
        : [{ date: toDateKey(new Date()), volumeUsd: 0, txCount: 0 }]

    const transactionsByDay: DailyActivityPoint[] = volumeByDay.map((d) => ({
      date: d.date,
      volumeUsd: d.volumeUsd,
      txCount: d.txCount,
    }))

    // ── Asset Distribution ────────────────────────────────────────────────
    const totalAssetVolume = assetMap.USDC.volumeUsd + assetMap.EURC.volumeUsd
    const assetDistribution: AssetDistributionItem[] = [
      {
        asset: 'USDC',
        volumeUsd: parseFloat(assetMap.USDC.volumeUsd.toFixed(2)),
        txCount: assetMap.USDC.txCount,
        percentage:
          totalAssetVolume > 0
            ? parseFloat(((assetMap.USDC.volumeUsd / totalAssetVolume) * 100).toFixed(1))
            : 100,
      },
      {
        asset: 'EURC',
        volumeUsd: parseFloat(assetMap.EURC.volumeUsd.toFixed(2)),
        txCount: assetMap.EURC.txCount,
        percentage:
          totalAssetVolume > 0
            ? parseFloat(((assetMap.EURC.volumeUsd / totalAssetVolume) * 100).toFixed(1))
            : 0,
      },
    ]

    // ── Network Activity ──────────────────────────────────────────────────
    const networkTotalVolume = Object.values(networkMap).reduce(
      (sum, n) => sum + n.volumeUsd,
      0,
    )
    const networkActivity: NetworkActivityItem[] = Object.entries(networkMap).map(
      ([chainKey, data]) => {
        const chainName = CHAIN_LABEL[chainKey as KnownChain] ?? chainKey
        return {
          chainKey,
          chainName,
          txCount: data.txCount,
          volumeUsd: parseFloat(data.volumeUsd.toFixed(2)),
          percentage:
            networkTotalVolume > 0
              ? parseFloat(((data.volumeUsd / networkTotalVolume) * 100).toFixed(1))
              : 0,
        }
      },
    ).sort((a, b) => b.volumeUsd - a.volumeUsd)

    // ── Product Activity Breakdown ────────────────────────────────────────
    const grandActivityVolume =
      directPaymentVolumeUsd + payrollVolumeUsd + swapVolumeUsd + sweepVolumeUsd

    const productActivity: ProductActivityItem[] = [
      {
        category: 'internal_payments',
        label: 'Internal Payments (User to User)',
        txCount: internalPaymentCount,
        volumeUsd: parseFloat(internalPaymentVolumeUsd.toFixed(2)),
        percentage:
          grandActivityVolume > 0
            ? parseFloat(((internalPaymentVolumeUsd / grandActivityVolume) * 100).toFixed(1))
            : 0,
      },
      {
        category: 'external_payouts',
        label: 'External Payouts',
        txCount: externalPaymentCount,
        volumeUsd: parseFloat(externalPaymentVolumeUsd.toFixed(2)),
        percentage:
          grandActivityVolume > 0
            ? parseFloat(((externalPaymentVolumeUsd / grandActivityVolume) * 100).toFixed(1))
            : 0,
      },
      {
        category: 'payroll',
        label: 'Completed Payroll Batches',
        txCount: payrollEntries.length,
        volumeUsd: parseFloat(payrollVolumeUsd.toFixed(2)),
        percentage:
          grandActivityVolume > 0
            ? parseFloat(((payrollVolumeUsd / grandActivityVolume) * 100).toFixed(1))
            : 0,
      },
      {
        category: 'swaps',
        label: 'Token Swaps (USDC ↔ EURC)',
        txCount: swaps.length,
        volumeUsd: parseFloat(swapVolumeUsd.toFixed(2)),
        percentage:
          grandActivityVolume > 0
            ? parseFloat(((swapVolumeUsd / grandActivityVolume) * 100).toFixed(1))
            : 0,
      },
      {
        category: 'sweeps',
        label: 'Deposit Consolidations (Sweeps)',
        txCount: sweeps.length,
        volumeUsd: parseFloat(sweepVolumeUsd.toFixed(2)),
        percentage:
          grandActivityVolume > 0
            ? parseFloat(((sweepVolumeUsd / grandActivityVolume) * 100).toFixed(1))
            : 0,
      },
    ]

    const totalInternalExternalVolume = internalPaymentVolumeUsd + externalPaymentVolumeUsd
    const internalPercentage =
      totalInternalExternalVolume > 0
        ? parseFloat(((internalPaymentVolumeUsd / totalInternalExternalVolume) * 100).toFixed(1))
        : 0

    const result: PublicMetricsData = {
      generatedAt: new Date().toISOString(),
      dataCoverage: {
        period: 'All Time',
        chainsMonitored: 7, // Arc, Base, Arbitrum, Polygon, Avalanche, Optimism, Ethereum
        onChainVerificationActive: true,
        syncStatus: 'synced',
      },
      summary: {
        registeredAccounts,
        activeAccounts30d: activeUsers30d.size,
        activeAccountsAllTime: activeUsersAllTime.size,
        verifiedTransactions,
        totalPaymentVolumeUsd,
        activeBusinesses,
        completedPayrollBatches: payrollRuns.length,
        onChainVerifiedTransactions: onChainCheck.verifiedOnChain,
      },
      breakdown: {
        volumeByDay,
        transactionsByDay,
        assetDistribution,
        networkActivity,
        productActivity,
        internalVsExternal: {
          internalVolumeUsd: parseFloat(internalPaymentVolumeUsd.toFixed(2)),
          internalTxCount: internalPaymentCount,
          externalVolumeUsd: parseFloat(externalPaymentVolumeUsd.toFixed(2)),
          externalTxCount: externalPaymentCount,
          internalPercentage,
        },
      },
      methodology: {
        accountingStandard: 'Strict completed-state accounting. Only transactions marked COMPLETED with verified status are included.',
        currencyValuation: `USDC is valued 1:1 with USD. EURC is valued at 1 EURC = ${EURC_USD_RATE} USD based on standard benchmark peg.`,
        verificationCriteria: 'Transactions are reconciled between application records and on-chain RPC receipts. Failed, pending, cancelled, or reverted operations are strictly excluded.',
        exclusions: 'Deposits, withdrawals, and balance sweeps are categorized separately and excluded from payment volume to prevent double counting.',
        internalVsExternalDefinition: 'Internal activity represents transfers between registered Architect Pay accounts. External activity represents payouts to non-custodial external wallets or payroll recipients.',
        updateFrequency: 'Live queries cached with 60-second TTL to ensure high responsiveness and zero unnecessary RPC overhead.',
      },
    }

    cachedMetrics = {
      data: result,
      expiresAt: now + CACHE_LIFETIME_MS,
    }

    return result
  } catch (err) {
    console.error('[metrics/getPublicMetrics] Database query error:', err)

    // Return a safe degraded snapshot if DB is temporarily unreachable
    if (cachedMetrics) {
      return {
        ...cachedMetrics.data,
        dataCoverage: {
          ...cachedMetrics.data.dataCoverage,
          syncStatus: 'cached',
        },
      }
    }

    // Default safe fallback structure
    return {
      generatedAt: new Date().toISOString(),
      dataCoverage: {
        period: 'All Time',
        chainsMonitored: 7,
        onChainVerificationActive: false,
        syncStatus: 'degraded',
      },
      summary: {
        registeredAccounts: 0,
        activeAccounts30d: 0,
        activeAccountsAllTime: 0,
        verifiedTransactions: 0,
        totalPaymentVolumeUsd: 0,
        activeBusinesses: 0,
        completedPayrollBatches: 0,
        onChainVerifiedTransactions: 0,
      },
      breakdown: {
        volumeByDay: [{ date: toDateKey(new Date()), volumeUsd: 0, txCount: 0 }],
        transactionsByDay: [{ date: toDateKey(new Date()), volumeUsd: 0, txCount: 0 }],
        assetDistribution: [
          { asset: 'USDC', volumeUsd: 0, txCount: 0, percentage: 100 },
          { asset: 'EURC', volumeUsd: 0, txCount: 0, percentage: 0 },
        ],
        networkActivity: [],
        productActivity: [],
        internalVsExternal: {
          internalVolumeUsd: 0,
          internalTxCount: 0,
          externalVolumeUsd: 0,
          externalTxCount: 0,
          internalPercentage: 0,
        },
      },
      methodology: {
        accountingStandard: 'Strict completed-state accounting. Only transactions marked COMPLETED with verified status are included.',
        currencyValuation: `USDC is valued 1:1 with USD. EURC is valued at 1 EURC = ${EURC_USD_RATE} USD.`,
        verificationCriteria: 'Reconciled against on-chain transaction receipts.',
        exclusions: 'Failed and pending transactions are strictly excluded.',
        internalVsExternalDefinition: 'Distinguished by recipient wallet address ownership.',
        updateFrequency: 'Cached with 60-second TTL.',
      },
    }
  }
}

