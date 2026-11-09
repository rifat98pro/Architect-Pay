'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Users,
  Activity,
  CheckCircle2,
  DollarSign,
  Building2,
  CalendarCheck,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { PublicMetricsData } from '@/lib/metrics'
import { KpiCard } from '@/components/metrics/kpi-card'
import {
  VolumeActivityChart,
  AssetDistributionChart,
  NetworkActivityChart,
  ProductActivityChart,
} from '@/components/metrics/charts'
import { MethodologySection } from '@/components/metrics/methodology'

interface MetricsViewProps {
  initialData: PublicMetricsData
}

export function MetricsView({ initialData }: MetricsViewProps) {
  const [data, setData] = useState<PublicMetricsData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date(initialData.generatedAt))

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/public-metrics?refresh=true')
      if (res.ok) {
        const json = (await res.json()) as PublicMetricsData
        setData(json)
        setLastRefreshed(new Date(json.generatedAt))
      }
    } catch (e) {
      console.error('Failed to refresh metrics:', e)
    } finally {
      setIsRefreshing(false)
    }
  }

  const { summary, breakdown, dataCoverage } = data

  return (
    <div className="min-h-screen bg-[#000] text-[#e2eaf4]">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#000]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <Image
              src="/logo.png"
              alt="Architect Pay"
              width={32}
              height={32}
              className="rounded-xl object-contain"
            />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-[#c5d3ed]">Architect</span>
              <span className="text-[#2aabab]"> Pay</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden text-sm font-medium text-gray-400 transition-colors hover:text-white sm:block"
            >
              Main Website
            </Link>
            <Link
              href="/docs"
              className="hidden text-sm font-medium text-gray-400 transition-colors hover:text-white md:block"
            >
              Docs
            </Link>
            <Link
              href="/api/public-metrics"
              target="_blank"
              className="hidden items-center gap-1 text-xs font-medium text-[#2aabab] transition-opacity hover:opacity-80 sm:flex"
            >
              API Endpoint <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full bg-[#2aabab] px-4 py-2 text-xs font-semibold text-black transition-all hover:opacity-90"
            >
              Launch App <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Header Section ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5 px-6 py-12 md:py-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 20%, rgba(42,171,171,0.09) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-[#2aabab] mb-3">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Ecosystem Transparency
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Architect Pay <span className="text-[#2aabab]">Metrics</span>
              </h1>
              <p className="mt-2 text-sm text-gray-400 md:text-base max-w-2xl">
                Transparent product activity, multi-chain payment volume, and verified on-chain analytics powered by Circle CCTP and Arc Mainnet.
              </p>
            </div>

            {/* Sync Status & Refresh */}
            <div className="flex items-center gap-3 self-start md:self-auto rounded-xl border border-white/10 bg-white/5 p-2 px-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-gray-300">
                  Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Refresh metrics from database"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-[#2aabab]' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Quick ecosystem badges */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300 font-medium">
              Hub Chain: <strong className="text-white">Arc Mainnet</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300 font-medium">
              Settlement: <strong className="text-white">Circle CCTP V2</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300 font-medium">
              Tokens: <strong className="text-white">USDC &amp; EURC</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300 font-medium">
              Networks: <strong className="text-white">Arc, Base, Arbitrum, Polygon, Avalanche, Optimism</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {/* ── KPI Cards Grid ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Core Performance Indicators
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Total Registered Accounts"
              value={summary.registeredAccounts.toLocaleString()}
              subtitle="Registered user accounts in application database"
              badge="Database Verified"
              badgeColor="teal"
              icon={Users}
              tooltip="Distinct user accounts registered via email OTP and OAuth authentication."
            />

            <KpiCard
              title="Active Accounts"
              value={summary.activeAccounts30d.toLocaleString()}
              subtitle={`${summary.activeAccountsAllTime} all-time active accounts`}
              badge="30-Day Window"
              badgeColor="navy"
              icon={Activity}
              tooltip="Accounts that executed at least one completed payment, payroll run, or swap."
            />

            <KpiCard
              title="Verified Transactions"
              value={summary.verifiedTransactions.toLocaleString()}
              subtitle={`${summary.onChainVerifiedTransactions} verified with on-chain receipts`}
              badge="Completed Only"
              badgeColor="teal"
              icon={CheckCircle2}
              tooltip="Excludes pending, failed, or cancelled transactions. Reconciled against RPC receipts."
            />

            <KpiCard
              title="Total Verified Payment Volume"
              value={`$${summary.totalPaymentVolumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subtitle="Combined direct payments & employee payroll"
              badge="USD Valued"
              badgeColor="teal"
              icon={DollarSign}
              tooltip="Pure payment volume. Swaps and balance sweeps are excluded from this total."
            />

            <KpiCard
              title="Active Businesses"
              value={summary.activeBusinesses.toLocaleString()}
              subtitle="Registered business entities with active payroll"
              badge="Fintech Payroll"
              badgeColor="purple"
              icon={Building2}
              tooltip="Business accounts with registered employees or completed payroll runs."
            />

            <KpiCard
              title="Completed Payroll Batches"
              value={summary.completedPayrollBatches.toLocaleString()}
              subtitle="Fully settled batch payroll distributions"
              badge="100% Settled"
              badgeColor="teal"
              icon={CalendarCheck}
              tooltip="Multi-employee automated payroll batches with confirmed settlement."
            />
          </div>
        </div>

        {/* ── Internal vs External Activity Callout ──────────────────── */}
        <div
          className="rounded-2xl border p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#2aabab]" />
                <h3 className="text-base font-bold text-white">
                  Internal Operations vs. External Adoption
                </h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Transparent segmentation distinguishing internal ecosystem activity from external wallet payouts
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              Adoption Distribution
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                External Payouts &amp; Payroll
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                ${breakdown.internalVsExternal.externalVolumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-[#2aabab]">
                {breakdown.internalVsExternal.externalTxCount} transactions · {100 - breakdown.internalVsExternal.internalPercentage}% of volume
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Disbursements sent to non-custodial external EVM wallets, suppliers, and payroll recipients.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Internal Account Transfers
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                ${breakdown.internalVsExternal.internalVolumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-blue-400">
                {breakdown.internalVsExternal.internalTxCount} transactions · {breakdown.internalVsExternal.internalPercentage}% of volume
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Instant peer-to-peer transfers settled between registered Architect Pay usernames and wallets.
              </p>
            </div>
          </div>
        </div>

        {/* ── Charts Grid: Timeline & Asset Distribution ─────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <VolumeActivityChart data={breakdown.volumeByDay} />
          </div>
          <div>
            <AssetDistributionChart distribution={breakdown.assetDistribution} />
          </div>
        </div>

        {/* ── Network & Product Activity Grid ────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <NetworkActivityChart activity={breakdown.networkActivity} />
          <ProductActivityChart activity={breakdown.productActivity} />
        </div>

        {/* ── Methodology & Transparency Section ─────────────────────── */}
        <MethodologySection />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#000] px-6 py-10 text-xs text-gray-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Architect Pay"
              width={20}
              height={20}
              className="rounded-md object-contain opacity-60"
            />
            <span>
              Architect Pay Metrics · Public Verified Traction Dashboard
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/api/public-metrics" target="_blank" className="text-[#2aabab] hover:underline">
              Public Metrics JSON API
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

