'use client'

import { useEffect, useState } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink, ChevronDown, ChevronRight, Building2, Users, DollarSign, Wallet, Calendar, Clock } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'

const ARC_EXPLORER = 'https://testnet.arcscan.app'

interface Employee { id: string; name: string; walletAddress: string }
interface PayrollEntry {
  id:           string
  amount:       string
  status:       string
  txHash:       string | null
  errorMessage: string | null
  employee:     Employee
}
interface PayrollRun {
  id:          string
  status:      string
  totalAmount: string
  createdAt:   string
  entries:     PayrollEntry[]
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  COMPLETED:  { label: 'Completed',  className: 'text-green-400 bg-green-400/10',  dot: 'bg-green-400'  },
  PARTIAL:    { label: 'Partial',    className: 'text-amber-400 bg-amber-400/10',  dot: 'bg-amber-400'  },
  FAILED:     { label: 'Failed',     className: 'text-red-400 bg-red-400/10',      dot: 'bg-red-400'    },
  PROCESSING: { label: 'Processing', className: 'text-blue-400 bg-blue-400/10',    dot: 'bg-blue-400'   },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PROCESSING
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${status === 'PROCESSING' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

export default function PayrollPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [payrollUI, setPayrollUI] = useFeatureState('payroll-ui', {
    businessId: '',
    expanded:   null as string | null,
  })
  const businessId  = payrollUI.businessId
  const expanded    = payrollUI.expanded
  const setBusinessId = (v: string)      => setPayrollUI({ businessId: v })
  const setExpanded   = (v: string | null) => setPayrollUI({ expanded: v })

  const [businesses,    setBusinesses]    = useState<{ id: string; name: string; scheduledDay?: number | null }[]>([])
  const [scheduleDay,   setScheduleDay]   = useState<number | null>(null)
  const [pendingDay,    setPendingDay]    = useState<number | null>(null)
  const [editingSched,  setEditingSched]  = useState(false)
  const [savingSched,   setSavingSched]   = useState(false)
  const [chainBalances,     setChainBalances]     = useState<Record<string, string>>({})
  const [eurcChainBalances, setEurcChainBalances] = useState<Record<string, string>>({})
  const [employees,         setEmployees]         = useState<{ id: string; salary: string; preferredToken?: string }[]>([])
  const [runs,          setRuns]          = useState<PayrollRun[]>([])
  const [loading,       setLoading]       = useState(true)
  const [running,       setRunning]       = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function loadData(bizId?: string) {
    const fetches: Promise<void>[] = [
      fetch('/api/wallet/balance').then((r) => r.json()).then((d) => { setChainBalances(d.chainBalances ?? {}); setEurcChainBalances(d.eurcChainBalances ?? {}) }),
      fetch('/api/payroll/runs').then((r) => r.json()).then((d) => setRuns(d.runs ?? [])),
      fetch('/api/businesses').then((r) => r.json()).then((d) => setBusinesses(d.businesses ?? [])),
    ]
    if (bizId) {
      fetches.push(
        fetch(`/api/employees?businessId=${bizId}`).then((r) => r.json()).then((d) => setEmployees(d.employees ?? []))
      )
    } else {
      setEmployees([])
    }
    await Promise.all(fetches)
    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) loadData(businessId || undefined)
  }, [user?.id, businessId])

  // Sync scheduleDay when business changes
  useEffect(() => {
    const biz = businesses.find((b) => b.id === businessId)
    const day = biz?.scheduledDay ?? null
    setScheduleDay(day)
    setPendingDay(day)
    setEditingSched(!day) // open editor if no schedule set yet
  }, [businessId, businesses])

  async function saveSchedule() {
    if (!businessId) return
    setSavingSched(true)
    try {
      await fetch(`/api/businesses/${businessId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scheduledDay: pendingDay }),
      })
      setScheduleDay(pendingDay)
      setBusinesses((prev) => prev.map((b) => b.id === businessId ? { ...b, scheduledDay: pendingDay } : b))
      setEditingSched(false)
    } finally { setSavingSched(false) }
  }

  async function removeSchedule() {
    if (!businessId) return
    setSavingSched(true)
    try {
      await fetch(`/api/businesses/${businessId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scheduledDay: null }),
      })
      setScheduleDay(null)
      setPendingDay(null)
      setBusinesses((prev) => prev.map((b) => b.id === businessId ? { ...b, scheduledDay: null } : b))
      setEditingSched(true)
    } finally { setSavingSched(false) }
  }

  const usdcEmps       = employees.filter((e) => (e.preferredToken ?? 'USDC') === 'USDC')
  const eurcEmps       = employees.filter((e) => e.preferredToken === 'EURC')
  const totalUsdcSalary = usdcEmps.reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalEurcSalary = eurcEmps.reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalSalary    = totalUsdcSalary + totalEurcSalary
  const totalUsdcBalance = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const arcEurcBalance   = parseFloat(eurcChainBalances['ARC-TESTNET'] ?? '0')
  const arcBalance       = parseFloat(chainBalances['ARC-TESTNET'] ?? '0')
  const usdcOk           = totalUsdcSalary === 0 || totalUsdcBalance >= totalUsdcSalary
  const eurcOk           = totalEurcSalary === 0 || arcEurcBalance >= totalEurcSalary
  const canRun         = !!businessId && employees.length > 0 && usdcOk && eurcOk
  const needsCctp      = !!businessId && totalUsdcSalary > 0 && arcBalance < totalUsdcSalary && totalUsdcBalance >= totalUsdcSalary
  const usdcShortfall  = Math.max(0, totalUsdcSalary - totalUsdcBalance)
  const eurcShortfall  = Math.max(0, totalEurcSalary - arcEurcBalance)

  async function handleRun() {
    setError('')
    setSuccess('')
    setRunning(true)
    try {
      const res  = await fetch('/api/payroll/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ businessId: businessId ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Payroll complete — ${data.completed} paid, ${data.failed} failed.`)
      await loadData(businessId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payroll run failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Payroll</h1>
        <p className="mt-1 text-sm text-gray-500">Review and run payroll for your team.</p>
      </div>

      {/* Business selector */}
      {businesses.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-gray-700 px-6 py-8 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-400">No businesses found. <a href="/businesses" className="text-brand-400 hover:underline">Create one first</a> to run payroll.</p>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-gray-400">Business</label>
          <div className="relative flex-1 max-w-xs">
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 pr-9 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="">Select a business</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/60 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
            <Users className="h-3.5 w-3.5" /> Employees
          </div>
          <div className="text-2xl font-bold text-white">{employees.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/60 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
            <DollarSign className="h-3.5 w-3.5" /> Total payout
          </div>
          {totalUsdcSalary > 0 && <div className="text-xl font-bold text-white">${totalUsdcSalary.toFixed(2)} <span className="text-sm font-semibold text-gray-400">USDC</span></div>}
          {totalEurcSalary > 0 && <div className="text-xl font-bold text-white">€{totalEurcSalary.toFixed(2)} <span className="text-sm font-semibold text-gray-400">EURC</span></div>}
          {totalSalary === 0 && <div className="text-2xl font-bold text-white">$0.00</div>}
          <div className="mt-1 text-xs text-amber-500/70">+0.01% platform fee</div>
        </div>
        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/60 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
            <Wallet className="h-3.5 w-3.5" /> Your balance
          </div>
          <div className={`text-xl font-bold ${usdcOk ? 'text-white' : 'text-red-400'}`}>
            ${totalUsdcBalance.toFixed(2)} <span className="text-sm font-semibold text-gray-400">USDC</span>
          </div>
          <div className={`text-xl font-bold ${eurcOk ? 'text-white' : 'text-red-400'}`}>
            €{arcEurcBalance.toFixed(2)} <span className="text-sm font-semibold text-gray-400">EURC</span>
          </div>
        </div>
      </div>


      {/* Alerts */}
      {error   && <div className="mb-4 rounded-2xl border border-red-900/40 bg-red-900/20 px-5 py-3.5 text-sm text-red-400">{error}</div>}
      {success && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-900/40 bg-green-900/20 px-5 py-3.5 text-sm text-green-400"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

      {needsCctp && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-900/40 bg-amber-900/10 px-5 py-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-sm text-amber-400">Arc USDC balance (${arcBalance.toFixed(2)}) is lower than payout. Funds will be aggregated via Circle CCTP from your other chains — adds ~2–3 min.</p>
        </div>
      )}

      {eurcEmps.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-900/30 bg-blue-900/10 px-5 py-3.5">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-blue-400/50 flex items-center justify-center text-[10px] font-bold text-blue-400">i</div>
          <div>
            <p className="text-sm font-medium text-blue-300">EURC payroll sources from Arc only</p>
            <p className="mt-0.5 text-xs text-blue-400/70">EURC payroll is settled instantly from your Arc wallet. Ensure your Arc EURC balance covers the total before running. You can deposit EURC to Arc from the Dashboard.</p>
          </div>
        </div>
      )}

      {!businessId && businesses.length > 0 && (
        <p className="mb-4 text-sm text-gray-500">Select a business above to preview payroll.</p>
      )}
      {businessId && employees.length === 0 && !loading && (
        <p className="mb-4 text-sm text-gray-500">
          No employees in this business. <a href="/businesses" className="text-brand-400 hover:underline">Add employees</a> to run payroll.
        </p>
      )}

      {/* Run payroll */}
      <div className="mb-8">
        <button
          onClick={handleRun}
          disabled={running || !canRun || loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-500 py-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          {running ? 'Running payroll...' : canRun
            ? `Run Payroll — ${[
                totalUsdcSalary > 0 ? `$${totalUsdcSalary.toFixed(2)} USDC` : '',
                totalEurcSalary > 0 ? `€${totalEurcSalary.toFixed(2)} EURC` : '',
              ].filter(Boolean).join(' + ')} to ${employees.length} employee${employees.length !== 1 ? 's' : ''}`
            : 'Run Payroll'}
        </button>
        {!canRun && employees.length > 0 && !loading && (usdcShortfall > 0 || eurcShortfall > 0) && (
          <p className="mt-2 text-center text-xs text-red-400">
            Insufficient balance —{usdcShortfall > 0 ? ` need $${usdcShortfall.toFixed(2)} more USDC` : ''}{usdcShortfall > 0 && eurcShortfall > 0 ? ' &' : ''}{eurcShortfall > 0 ? ` need €${eurcShortfall.toFixed(2)} more EURC` : ''}
          </p>
        )}
      </div>

      {/* Scheduled payroll */}
      {businessId && (() => {
        const now      = new Date()
        const nextDate = scheduleDay
          ? (() => {
              const d = new Date(now.getFullYear(), now.getMonth(), scheduleDay)
              if (d <= now) d.setMonth(d.getMonth() + 1)
              return d
            })()
          : null
        const nextPayday = nextDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

        return (
          <div className="mb-8 rounded-2xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">Payroll Schedule</span>
              </div>
              <div className="flex items-center gap-3">
                {savingSched && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" />}
                {scheduleDay && !editingSched && !savingSched && (
                  <>
                    <button
                      onClick={() => { setPendingDay(scheduleDay); setEditingSched(true) }}
                      className="text-xs font-medium text-brand-400 hover:underline"
                    >
                      Edit
                    </button>
                    <span className="text-gray-700">·</span>
                    <button onClick={removeSchedule} className="text-xs text-red-400 hover:underline">
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Active schedule summary — Gusto style stat row */}
            {scheduleDay && !editingSched && (
              <div className="grid grid-cols-2 divide-x divide-gray-700/50 border-b border-gray-700/50">
                <div className="px-5 py-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">Runs every month on</div>
                  <div className="text-xl font-bold text-white">Day {scheduleDay}</div>
                </div>
                <div className="px-5 py-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">Next payday</div>
                  <div className="text-base font-bold text-brand-400">{nextPayday}</div>
                </div>
              </div>
            )}

            {/* Editor — shown when editing or no schedule yet */}
            {(editingSched || !scheduleDay) && (
              <div className="p-5">
                {!scheduleDay && (
                  <p className="mb-4 text-sm text-gray-500">
                    No schedule set — pick a day below to automate monthly payroll.
                  </p>
                )}

                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Select payday</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPendingDay(pendingDay === d ? null : d)}
                      disabled={savingSched}
                      className={`flex h-9 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed
                        ${pendingDay === d
                          ? 'bg-brand-500 text-navy-950 shadow-[0_0_14px_rgba(42,171,171,0.4)]'
                          : 'border border-gray-700 bg-gray-800/50 text-gray-400 hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-white'
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={saveSchedule}
                    disabled={!pendingDay || savingSched}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingSched ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {savingSched ? 'Saving…' : 'Save Schedule'}
                  </button>
                  {editingSched && scheduleDay && (
                    <button
                      onClick={() => { setPendingDay(scheduleDay); setEditingSched(false) }}
                      className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 transition"
                    >
                      Cancel
                    </button>
                  )}
                  {pendingDay && (
                    <span className="text-xs text-gray-500">
                      Day {pendingDay} selected
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Capped at day 28 to work every month including February · Triggers at midnight UTC
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* History */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Payroll History</h2>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-sm text-gray-600">No payroll runs yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-700/60 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-gray-700/60 bg-gray-900/60 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              <span className="w-6" />
              <span>Date</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y divide-gray-800/60 bg-gray-900/40">
              {runs.map((run) => {
                const open = expanded === run.id
                return (
                  <div key={run.id}>
                    <button
                      onClick={() => setExpanded(open ? null : run.id)}
                      className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4 text-left hover:bg-gray-800/20 transition"
                    >
                      <div className="w-6 flex items-center justify-center text-gray-600">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {new Date(run.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(run.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {run.entries.length} payments
                        </div>
                      </div>
                      <StatusBadge status={run.status} />
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">${parseFloat(run.totalAmount).toFixed(2)}</div>
                        <div className="text-xs text-gray-600">mixed</div>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-gray-800/40 bg-gray-950/30">
                        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-2 text-xs font-medium uppercase tracking-wide text-gray-600">
                          <span className="w-6" />
                          <span>Employee</span>
                          <span>Status</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {run.entries.map((entry) => (
                          <div key={entry.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-3 border-t border-gray-800/30">
                            <div className="w-6 flex items-center justify-center">
                              {entry.status === 'COMPLETED'
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                : <XCircle className="h-3.5 w-3.5 text-red-400" />
                              }
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">{entry.employee.name}</div>
                              <div className="font-mono text-xs text-gray-600">{truncateAddress(entry.employee.walletAddress, 6)}</div>
                              {entry.errorMessage && <div className="text-xs text-red-400 mt-0.5">{entry.errorMessage}</div>}
                            </div>
                            <div>
                              {entry.status === 'COMPLETED'
                                ? <span className="inline-flex items-center gap-1 rounded-full bg-green-400/10 px-2.5 py-1 text-xs font-medium text-green-400">Paid</span>
                                : <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-1 text-xs font-medium text-red-400">Failed</span>
                              }
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-white">${parseFloat(entry.amount).toFixed(2)}</div>
                              {entry.txHash && (
                                <a
                                  href={`${ARC_EXPLORER}/tx/${entry.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
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
          </div>
        )}
      </div>
    </div>
  )
}
