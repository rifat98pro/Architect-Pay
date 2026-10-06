'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, AlertTriangle, Loader2, ChevronDown, ArrowLeftRight, ArrowRight, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import TokenLogo from '@/components/token-logo'
import ChainLogo from '@/components/chain-logo'
import { useTheme } from '@/context/theme-context'

const ARC_EXPLORER = 'https://testnet.arcscan.app'

interface Payment {
  id:               string
  recipientAddress: string
  recipientLabel:   string | null
  amount:           string
  token:            string
  sourceChain:      string
  destChain:        string
  status:           string
  txHash:           string | null
  createdAt:        string
  updatedAt:        string
}

interface PayrollEntry {
  id:           string
  amount:       string
  status:       string
  txHash:       string | null
  errorMessage: string | null
  employee:     { name: string; walletAddress: string }
}

interface SwapRecord {
  id:        string
  tokenIn:   string
  tokenOut:  string
  amountIn:  string
  amountOut: string | null
  srcChain:  string
  destChain: string
  status:    string
  txHash:    string | null
  errorMsg:  string | null
  createdAt: string
}

interface PayrollRun {
  id:          string
  status:      string
  totalAmount: string
  createdAt:   string
  entries:     PayrollEntry[]
  business:    { name: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const { theme } = useTheme()
  const L = theme === 'light'

  const map: Record<string, { icon: React.ReactNode; label: string; dark: string; light: string }> = {
    COMPLETED:  { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed',  dark: 'bg-green-900/30 text-green-400 border-green-900/50',   light: 'bg-green-100 text-green-700 border-green-300' },
    FAILED:     { icon: <XCircle className="h-3 w-3" />,      label: 'Failed',     dark: 'bg-red-900/30 text-red-400 border-red-900/50',         light: 'bg-red-100 text-red-600 border-red-300' },
    PENDING:    { icon: <Clock className="h-3 w-3" />,         label: 'Pending',    dark: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50', light: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    PROCESSING: { icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: 'Processing', dark: 'bg-blue-900/30 text-blue-400 border-blue-900/50', light: 'bg-blue-100 text-blue-700 border-blue-300' },
    PARTIAL:    { icon: <AlertTriangle className="h-3 w-3" />, label: 'Partial',   dark: 'bg-amber-900/30 text-amber-400 border-amber-900/50',   light: 'bg-amber-100 text-amber-700 border-amber-300' },
  }
  const s = map[status] ?? map.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', L ? s.light : s.dark)}>
      {s.icon}{s.label}
    </span>
  )
}

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function TxTimer({ createdAt, updatedAt, status }: {
  createdAt: string
  updatedAt?: string
  status: string
}) {
  const isActive = status === 'PENDING' || status === 'PROCESSING'
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (isActive) {
      const start = new Date(createdAt).getTime()
      const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    } else if (updatedAt) {
      const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime()
      setElapsed(Math.max(0, Math.floor(ms / 1000)))
    }
  }, [isActive, createdAt, updatedAt])

  if (isActive) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs text-yellow-500/80">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
        {formatElapsed(elapsed)}
      </div>
    )
  }
  if (!updatedAt || elapsed < 1) return null
  return (
    <div className={cn(
      'mt-1 flex items-center gap-1.5 text-xs',
      status === 'COMPLETED' ? 'text-green-500/70' : 'text-gray-600',
    )}>
      <Clock className="h-3 w-3" />
      Took {formatElapsed(elapsed)}
    </div>
  )
}

function HistoryPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [historyUI, setHistoryUI] = useFeatureState('history-ui', {
    tab:      'payments' as 'payments' | 'withdrawals' | 'received' | 'payroll' | 'swaps',
    expanded: null as string | null,
  })
  const tab      = historyUI.tab
  const expanded = historyUI.expanded
  const setTab      = (v: 'payments' | 'withdrawals' | 'received' | 'payroll' | 'swaps') => setHistoryUI({ tab: v })
  const setExpanded = (v: string | null)                     => setHistoryUI({ expanded: v })

  // Auto-switch tab from URL query param (e.g. ?tab=withdrawals)
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'withdrawals' || t === 'received' || t === 'payroll' || t === 'swaps' || t === 'payments') {
      setTab(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [payments,  setPayments]  = useState<Payment[]>([])
  const [received,  setReceived]  = useState<Payment[]>([])
  const [runs,      setRuns]      = useState<PayrollRun[]>([])
  const [swaps,     setSwaps]     = useState<SwapRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const mintPollRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  // Auto-complete any PROCESSING cross-chain payments (in case user navigated away from payments page)
  const paymentsRef = useRef(payments)
  paymentsRef.current = payments

  useEffect(() => {
    if (loading) return

    const tryMint = async () => {
      const processing = paymentsRef.current.filter((p) => p.status === 'PROCESSING')
      if (!processing.length) {
        if (mintPollRef.current) { clearInterval(mintPollRef.current); mintPollRef.current = null }
        return
      }
      for (const p of processing) {
        try {
          const res  = await fetch(`/api/payments/${p.id}/mint`, { method: 'POST' })
          const data = await res.json()
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            const completedAt = new Date().toISOString()
            setPayments((prev) =>
              prev.map((x) => x.id === p.id ? { ...x, status: data.status, txHash: data.txHash ?? x.txHash, updatedAt: completedAt } : x)
            )
          }
        } catch { /* retry next tick */ }
      }
    }

    tryMint()
    mintPollRef.current = setInterval(tryMint, 10_000)
    return () => { if (mintPollRef.current) { clearInterval(mintPollRef.current); mintPollRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      fetch('/api/payments/history').then((r) => r.json()),
      fetch('/api/payments/received').then((r) => r.json()),
      fetch('/api/payroll/runs').then((r) => r.json()),
      fetch('/api/swap/history').then((r) => r.json()),
    ]).then(([payData, recData, runData, swapData]) => {
      setPayments(payData.payments ?? [])
      setReceived(recData.received ?? [])
      setRuns(runData.runs ?? [])
      setSwaps(swapData.swaps ?? [])
    }).finally(() => setLoading(false))
  }, [user?.id])

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="mt-0.5 text-sm text-gray-500">All your payments and payroll runs</p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-700/60 bg-gray-900/60 p-1">
        {([
          { id: 'payments',    label: 'Payments' },
          { id: 'withdrawals', label: 'Withdrawals' },
          { id: 'received',    label: 'Received' },
          { id: 'payroll',     label: 'Payroll Runs' },
          { id: 'swaps',       label: 'Swaps' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              tab === t.id ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : tab === 'payments' ? (
        payments.filter((p) => !p.recipientLabel?.toLowerCase().includes('withdrawal')).length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
            <Clock className="h-8 w-8 text-gray-700" />
            No payments yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-gray-800 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recipient</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {payments.filter((p) => !p.recipientLabel?.toLowerCase().includes('withdrawal')).map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {p.recipientLabel ?? truncateAddress(p.recipientAddress, 6)}
                      </span>
                      {p.recipientLabel?.toLowerCase().includes('withdrawal') && (
                        <span className="shrink-0 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-400">
                          Withdrawal
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {p.sourceChain === 'ALL_CHAINS' ? (
                        <span className="text-xs font-medium text-brand-400">All Chains</span>
                      ) : (
                        <>
                          <ChainLogo chain={p.sourceChain} size={12} />
                          <span className="text-xs text-gray-500">{p.sourceChain.replace('-TESTNET','').replace('-SEPOLIA','').replace('-AMOY','')}</span>
                        </>
                      )}
                      {(p.sourceChain !== p.destChain) && (
                        <>
                          <ArrowRight className="h-3 w-3 text-gray-700 shrink-0" />
                          <ChainLogo chain={p.destChain} size={12} />
                          <span className="text-xs text-gray-500">{p.destChain.replace('-TESTNET','').replace('-SEPOLIA','').replace('-AMOY','')}</span>
                        </>
                      )}
                      <span className="text-gray-700">·</span>
                      <span className="font-mono text-xs text-gray-600">{truncateAddress(p.recipientAddress, 5)}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    <TxTimer createdAt={p.createdAt} updatedAt={p.updatedAt} status={p.status} />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">${formatUSDC(p.amount)}</div>
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token={(p.token as 'USDC' | 'EURC') ?? 'USDC'} size={12} />{p.token ?? 'USDC'}</div>
                    {p.txHash && (
                      <a
                        href={`${ARC_EXPLORER}/tx/${p.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                      >
                        {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        )
      ) : tab === 'withdrawals' ? (
        (() => {
          const withdrawals = payments.filter((p) => p.recipientLabel?.toLowerCase().includes('withdrawal'))
          return withdrawals.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
              <ArrowUpCircle className="h-8 w-8 text-gray-700" />
              No withdrawals yet
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-gray-800 px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Destination</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
              </div>
              <div className="divide-y divide-gray-800/60">
                {withdrawals.map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-medium text-white">
                          {truncateAddress(p.recipientAddress, 6)}
                        </span>
                        <span className="shrink-0 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-400">
                          Withdrawal
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <ChainLogo chain={p.destChain} size={12} />
                        <span className="text-xs text-gray-500">{p.destChain.replace('-TESTNET','').replace('-SEPOLIA','').replace('-AMOY','')}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-xs text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <TxTimer createdAt={p.createdAt} updatedAt={p.updatedAt} status={p.status} />
                      {p.txHash && (
                        <a
                          href={`${ARC_EXPLORER}/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                        >
                          {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">{p.token === 'EURC' ? '' : '$'}{formatUSDC(p.amount)}</div>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token={(p.token as 'USDC' | 'EURC') ?? 'USDC'} size={12} />{p.token ?? 'USDC'}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          )
        })()
      ) : tab === 'received' ? (
        received.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
            <ArrowDownCircle className="h-8 w-8 text-gray-700" />
            No received payments yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-gray-800 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sender</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {received.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-medium text-white">
                      {p.recipientLabel ? `${p.recipientLabel} · ` : ''}{truncateAddress(p.recipientAddress, 6)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <ChainLogo chain={p.destChain} size={12} />
                      <span className="text-xs text-gray-500">{p.destChain.replace('-TESTNET','').replace('-SEPOLIA','').replace('-AMOY','')}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    {p.txHash && (
                      <a
                        href={`${ARC_EXPLORER}/tx/${p.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                      >
                        {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-400">+{p.token === 'EURC' ? '' : '$'}{formatUSDC(p.amount)}</div>
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token={(p.token as 'USDC' | 'EURC') ?? 'USDC'} size={12} />{p.token ?? 'USDC'}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        )
      ) : tab === 'swaps' ? (
        swaps.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
            <ArrowLeftRight className="h-8 w-8 text-gray-700" />
            No swaps yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-gray-800 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Swap</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount In</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount Out</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {swaps.map((s) => {
                const isCross = s.srcChain !== s.destChain
                return (
                  <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <TokenLogo token={s.tokenIn as 'USDC' | 'EURC'} size={16} />
                        <span className="text-brand-400">{s.tokenIn}</span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-gray-500" />
                        <TokenLogo token={s.tokenOut as 'USDC' | 'EURC'} size={16} />
                        <span className="text-purple-400">{s.tokenOut}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <ChainLogo chain={s.srcChain} size={12} />
                        <span className="text-xs text-gray-500">{s.srcChain.replace('-TESTNET','').replace('-SEPOLIA','')}</span>
                        {isCross && (
                          <>
                            <ArrowLeftRight className="h-3 w-3 text-gray-700 shrink-0" />
                            <ChainLogo chain={s.destChain} size={12} />
                            <span className="text-xs text-gray-500">{s.destChain.replace('-TESTNET','').replace('-SEPOLIA','')}</span>
                          </>
                        )}
                        <span className="text-gray-700">·</span>
                        <span className="text-xs text-gray-600">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                      <TxTimer createdAt={s.createdAt} status={s.status} />
                      {s.txHash && (
                        <a
                          href={`${ARC_EXPLORER}/tx/${s.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                        >
                          {s.txHash.slice(0, 6)}…{s.txHash.slice(-4)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {s.errorMsg && <div className="mt-0.5 text-xs text-red-400">{s.errorMsg}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">{parseFloat(s.amountIn).toFixed(4)}</div>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token={s.tokenIn as 'USDC'|'EURC'} size={12} />{s.tokenIn}</div>
                    </div>
                    <div className="text-right">
                      {s.amountOut && parseFloat(s.amountOut) > 0 ? (
                        <>
                          <div className="text-sm font-semibold text-white">{parseFloat(s.amountOut).toFixed(4)}</div>
                          <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token={s.tokenOut as 'USDC'|'EURC'} size={12} />{s.tokenOut}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : (
        runs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
            <Clock className="h-8 w-8 text-gray-700" />
            No payroll runs yet
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const open = expanded === run.id
              const paid   = run.entries.filter((e) => e.status === 'COMPLETED').length
              const failed = run.entries.filter((e) => e.status === 'FAILED').length
              return (
                <div
                  key={run.id}
                  className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60"
                >
                  <button
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/30 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                        {run.business && (
                          <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                            {run.business.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        {paid > 0   && <span className="text-green-500">{paid} paid</span>}
                        {failed > 0 && <span className="text-red-500">{failed} failed</span>}
                        <span>{run.entries.length} total</span>
                      </div>
                      <TxTimer createdAt={run.createdAt} status={run.status} />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-white">${parseFloat(run.totalAmount).toFixed(2)}</div>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-500"><TokenLogo token="USDC" size={12} />USDC</div>
                    </div>
                    <StatusBadge status={run.status} />
                    <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform shrink-0', open && 'rotate-180')} />
                  </button>

                  {open && (
                    <div className="border-t border-gray-800">
                      {/* Sub-header */}
                      <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-gray-800 bg-gray-800/20 px-5 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Employee</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Status</span>
                      </div>
                      <div className="divide-y divide-gray-800/50">
                        {run.entries.map((entry) => (
                          <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">{entry.employee.name}</div>
                              <div className="font-mono text-xs text-gray-500">
                                {truncateAddress(entry.employee.walletAddress, 6)}
                              </div>
                              {entry.errorMessage && (
                                <div className="mt-0.5 text-xs text-red-400">{entry.errorMessage}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-white">${parseFloat(entry.amount).toFixed(2)}</div>
                              {entry.txHash && (
                                <a
                                  href={`${ARC_EXPLORER}/tx/${entry.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                                >
                                  {entry.txHash.slice(0, 6)}…
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                            <StatusBadge status={entry.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

export default function HistoryPageWrapper() {
  return (
    <Suspense>
      <HistoryPage />
    </Suspense>
  )
}
