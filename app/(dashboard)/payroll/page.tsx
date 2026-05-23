'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'

const ARC_EXPLORER = 'https://testnet.arcscan.app'

interface Employee { id: string; name: string; walletAddress: string }
interface PayrollEntry {
  id:          string
  amount:      string
  status:      string
  txHash:      string | null
  errorMessage: string | null
  employee:    Employee
}
interface PayrollRun {
  id:          string
  status:      string
  totalAmount: string
  createdAt:   string
  entries:     PayrollEntry[]
}

const RUN_STATUS: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  COMPLETED:  { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Completed',       className: 'text-green-600' },
  PARTIAL:    { icon: <AlertTriangle className="h-4 w-4" />, label: 'Partial',        className: 'text-amber-600' },
  FAILED:     { icon: <XCircle className="h-4 w-4" />,      label: 'Failed',          className: 'text-red-600'   },
  PROCESSING: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Processing', className: 'text-blue-600' },
}

export default function PayrollPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [chainBalances, setChainBalances] = useState<Record<string, string>>({})
  const [employees,  setEmployees]  = useState<{ id: string; salary: string }[]>([])
  const [runs,       setRuns]       = useState<PayrollRun[]>([])
  const [loading,    setLoading]    = useState(true)
  const [running,    setRunning]    = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [expanded,   setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function loadData() {
    const [balRes, empRes, runRes] = await Promise.all([
      fetch('/api/wallet/balance').then((r) => r.json()),
      fetch('/api/employees').then((r) => r.json()),
      fetch('/api/payroll/runs').then((r) => r.json()),
    ])
    setChainBalances(balRes.chainBalances ?? {})
    setEmployees(empRes.employees ?? [])
    setRuns(runRes.runs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const totalSalary  = employees.reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalBalance = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const arcBalance   = parseFloat(chainBalances['ARC-TESTNET'] ?? '0')
  const canRun       = employees.length > 0 && totalBalance >= totalSalary
  const needsCctp    = canRun && arcBalance < totalSalary

  async function handleRun() {
    setError('')
    setSuccess('')
    setRunning(true)
    try {
      const res  = await fetch('/api/payroll/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Payroll complete — ${data.completed} paid, ${data.failed} failed.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payroll run failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Run Payroll</h1>
      <p className="mb-6 text-sm text-gray-500">
        Pay all active employees at once from your Arc Testnet balance.
      </p>

      {/* Summary card */}
      <div className="card mb-6">
        {error   && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="mb-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{employees.length}</div>
            <div className="text-xs text-gray-400">Employees</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">${totalSalary.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Total payout</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${totalBalance >= totalSalary ? 'text-green-600' : 'text-red-500'}`}>
              ${totalBalance.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">Total balance</div>
          </div>
        </div>

        {/* Per-chain balance breakdown */}
        {Object.entries(chainBalances).filter(([, v]) => parseFloat(v) > 0).length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Object.entries(chainBalances).filter(([, v]) => parseFloat(v) > 0).map(([chain, bal]) => (
              <div key={chain} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                <div className="text-xs font-medium text-gray-900">${parseFloat(bal).toFixed(2)}</div>
                <div className="text-xs text-gray-400">{chain.replace('-', ' ').replace('TESTNET', 'Testnet')}</div>
              </div>
            ))}
          </div>
        )}

        {needsCctp && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
            Arc balance (${arcBalance.toFixed(2)}) is less than total payout. Will pull from other chains via CCTP before paying employees (~2–3 min extra).
          </div>
        )}

        {employees.length === 0 && (
          <p className="mb-4 text-center text-sm text-gray-400">
            Add employees first from the <a href="/employees" className="text-brand-600 hover:underline">Employees</a> page.
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={running || !canRun || loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running payroll...' : `Run Payroll — $${totalSalary.toFixed(2)} USDC`}
        </button>

        {!canRun && employees.length > 0 && !loading && (
          <p className="mt-2 text-center text-xs text-red-500">
            Insufficient total balance. Need ${totalSalary.toFixed(2)}, have ${totalBalance.toFixed(2)} USDC across all chains.
          </p>
        )}
      </div>

      {/* Payroll run history */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Payroll History</h2>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : runs.length === 0 ? (
        <div className="card py-10 text-center text-sm text-gray-400">No payroll runs yet.</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const meta = RUN_STATUS[run.status] ?? RUN_STATUS.PROCESSING
            const open = expanded === run.id
            return (
              <div key={run.id} className="card overflow-hidden p-0">
                <button
                  onClick={() => setExpanded(open ? null : run.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className={meta.className}>{meta.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                    <div className={`text-xs ${meta.className}`}>{meta.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">${parseFloat(run.totalAmount).toFixed(2)} USDC</div>
                    <div className="text-xs text-gray-400">{run.entries.length} payments</div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {run.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                        {entry.status === 'COMPLETED'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">{entry.employee.name}</div>
                          <div className="font-mono text-xs text-gray-400">
                            {truncateAddress(entry.employee.walletAddress, 6)}
                          </div>
                          {entry.errorMessage && (
                            <div className="text-xs text-red-500">{entry.errorMessage}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            ${parseFloat(entry.amount).toFixed(2)}
                          </div>
                          {entry.txHash && (
                            <a
                              href={`${ARC_EXPLORER}/tx/${entry.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                            >
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
      )}
    </div>
  )
}
