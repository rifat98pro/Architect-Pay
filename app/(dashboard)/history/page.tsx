'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'
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

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED:  <CheckCircle2 className="h-4 w-4 text-green-400" />,
  FAILED:     <XCircle className="h-4 w-4 text-red-400" />,
  PENDING:    <Clock className="h-4 w-4 text-yellow-400" />,
  PROCESSING: <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />,
  PARTIAL:    <AlertTriangle className="h-4 w-4 text-amber-400" />,
}

const RUN_LABEL: Record<string, { label: string; className: string }> = {
  COMPLETED:  { label: 'Completed',  className: 'text-green-400' },
  PARTIAL:    { label: 'Partial',    className: 'text-amber-400' },
  FAILED:     { label: 'Failed',     className: 'text-red-400'   },
  PROCESSING: { label: 'Processing', className: 'text-blue-400'  },
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
      <h1 className="mb-6 text-2xl font-bold text-white">History</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.12)' }}>
        {(['payments', 'payroll'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              tab === t
                ? 'bg-brand-500/15 text-brand-400'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {t === 'payments' ? 'Payments' : 'Payroll Runs'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : tab === 'payments' ? (
        payments.length === 0 ? (
          <div className="card py-12 text-center text-sm text-gray-500">No payments yet.</div>
        ) : (
          <div className="card divide-y divide-gray-800 overflow-hidden p-0">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="shrink-0">{STATUS_ICON[p.status]}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">
                    {p.recipientLabel ?? truncateAddress(p.recipientAddress, 6)}
                  </div>
                  <div className="font-mono text-xs text-gray-500">{truncateAddress(p.recipientAddress, 6)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">${formatUSDC(p.amount)} USDC</div>
                  <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</div>
                  {p.txHash && (
                    <a href={`${ARC_EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline">
                      {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        runs.length === 0 ? (
          <div className="card py-12 text-center text-sm text-gray-500">No payroll runs yet.</div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const meta = RUN_LABEL[run.status] ?? RUN_LABEL.PROCESSING
              const open = expanded === run.id
              return (
                <div key={run.id} className="card overflow-hidden p-0">
                  <button
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                  >
                    <span>{STATUS_ICON[run.status]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">
                        {new Date(run.createdAt).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${meta.className}`}>{meta.label}</span>
                        {run.business && (
                          <span className="text-xs text-gray-500">· {run.business.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-white">${parseFloat(run.totalAmount).toFixed(2)} USDC</div>
                      <div className="text-xs text-gray-500">{run.entries.length} payments</div>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-gray-800 divide-y divide-gray-800">
                      {run.entries.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                          {entry.status === 'COMPLETED'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white">{entry.employee.name}</div>
                            <div className="font-mono text-xs text-gray-500">{truncateAddress(entry.employee.walletAddress, 6)}</div>
                            {entry.errorMessage && <div className="text-xs text-red-400">{entry.errorMessage}</div>}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">${parseFloat(entry.amount).toFixed(2)}</div>
                            {entry.txHash && (
                              <a href={`${ARC_EXPLORER}/tx/${entry.txHash}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline">
                                {entry.txHash.slice(0, 6)}…{entry.txHash.slice(-4)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
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
