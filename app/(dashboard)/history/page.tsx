'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, AlertTriangle, Loader2, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ARC_EXPLORER = 'https://testnet.arcscan.app'

interface Payment {
  id:               string
  recipientAddress: string
  recipientLabel:   string | null
  amount:           string
  status:           string
  txHash:           string | null
  createdAt:        string
}

interface PayrollEntry {
  id:           string
  amount:       string
  status:       string
  txHash:       string | null
  errorMessage: string | null
  employee:     { name: string; walletAddress: string }
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
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    COMPLETED:  { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed',  cls: 'bg-green-900/30 text-green-400 border-green-900/50' },
    FAILED:     { icon: <XCircle className="h-3 w-3" />,      label: 'Failed',     cls: 'bg-red-900/30 text-red-400 border-red-900/50' },
    PENDING:    { icon: <Clock className="h-3 w-3" />,         label: 'Pending',    cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' },
    PROCESSING: { icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: 'Processing', cls: 'bg-blue-900/30 text-blue-400 border-blue-900/50' },
    PARTIAL:    { icon: <AlertTriangle className="h-3 w-3" />, label: 'Partial',   cls: 'bg-amber-900/30 text-amber-400 border-amber-900/50' },
  }
  const s = map[status] ?? map.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', s.cls)}>
      {s.icon}{s.label}
    </span>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [tab,      setTab]      = useState<'payments' | 'payroll'>('payments')
  const [payments, setPayments] = useState<Payment[]>([])
  const [runs,     setRuns]     = useState<PayrollRun[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      fetch('/api/payments/history').then((r) => r.json()),
      fetch('/api/payroll/runs').then((r) => r.json()),
    ]).then(([payData, runData]) => {
      setPayments(payData.payments ?? [])
      setRuns(runData.runs ?? [])
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
          { id: 'payments', label: 'Payments' },
          { id: 'payroll',  label: 'Payroll Runs' },
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
        payments.length === 0 ? (
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
              {payments.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {p.recipientLabel ?? truncateAddress(p.recipientAddress, 6)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{truncateAddress(p.recipientAddress, 6)}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">${formatUSDC(p.amount)}</div>
                    <div className="text-xs text-gray-500">USDC</div>
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
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-white">${parseFloat(run.totalAmount).toFixed(2)}</div>
                      <div className="text-xs text-gray-500">USDC</div>
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
