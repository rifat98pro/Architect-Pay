'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { usePendingPayments } from '@/context/pending-payments-context'
import { ArrowUpCircle, Loader2, CheckCircle2, XCircle, Layers, Send } from 'lucide-react'
import TokenLogo from '@/components/token-logo'
import ChainSelect from '@/components/chain-select'
import ChainLogo from '@/components/chain-logo'
import { cn } from '@/lib/utils'
import type { AggregatePlanEntry } from '@/lib/aggregate'

const DEST_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet'      },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia'      },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia' },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy'     },
]

const EURC_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet'      },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia'      },
]

function SectionLabel({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-400">
        {step}
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-200">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  )
}

export default function WithdrawPage() {
  const router         = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { addPending } = usePendingPayments()

  const [chainBalances, setChainBalances]         = useState<Record<string, string>>({})
  const [eurcChainBalances, setEurcChainBalances] = useState<Record<string, string>>({})

  const [token,     setToken]     = useState<'USDC' | 'EURC'>('USDC')
  const [destChain, setDestChain] = useState('ARC-TESTNET')
  const [amount,    setAmount]    = useState('')
  const [address,   setAddress]   = useState('')
  const [note,      setNote]      = useState('')

  // USDC aggregate plan
  const [planLoading,  setPlanLoading]  = useState(false)
  const [plan,         setPlan]         = useState<AggregatePlanEntry[] | null>(null)
  const [planFeasible, setPlanFeasible] = useState(true)
  const [planFee,      setPlanFee]      = useState('0')

  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((d) => {
        setChainBalances(d.chainBalances ?? {})
        setEurcChainBalances(d.eurcChainBalances ?? {})
      })
  }, [user?.id])

  // Auto-dismiss success 5s after completion
  useEffect(() => {
    if (!success || pendingId) return
    const t = setTimeout(() => setSuccess(''), 5000)
    return () => clearTimeout(t)
  }, [success, pendingId])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  useEffect(() => {
    if (!pendingId || pollRef.current) return
    startPolling(pendingId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset plan + amount on token switch
  useEffect(() => { setPlan(null); setAmount('') }, [token])

  // Fetch aggregate plan (USDC or EURC)
  const fetchPlan = useCallback(async (amt: string, tkn: 'USDC' | 'EURC', dest: string) => {
    const n = parseFloat(amt)
    if (!n || n <= 0) { setPlan(null); return }
    setPlanLoading(true)
    try {
      const url = tkn === 'USDC'
        ? `/api/payments/aggregate-plan?amount=${n}`
        : `/api/payments/aggregate-plan-eurc?amount=${n}&dest=${dest}`
      const res  = await fetch(url)
      const data = await res.json()
      setPlan(data.plan ?? null)
      setPlanFeasible(data.feasible ?? false)
      setPlanFee(data.totalFee ?? '0')
    } finally { setPlanLoading(false) }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const t = setTimeout(() => fetchPlan(amount, token, destChain), 500)
    return () => clearTimeout(t)
  }, [amount, token, destChain, user?.id, fetchPlan])

  function startPolling(paymentId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    const poll = async () => {
      try {
        const res  = await fetch(`/api/payments/${paymentId}/mint`, { method: 'POST' })
        const data = await res.json()
        if (data.status === 'COMPLETED') {
          clearInterval(pollRef.current!); pollRef.current = null
          setPendingId(null)
          setSuccess('Withdrawal completed successfully!')
          const bal = await fetch('/api/wallet/balance').then((r) => r.json())
          setChainBalances(bal.chainBalances ?? {})
          setEurcChainBalances(bal.eurcChainBalances ?? {})
        } else if (data.status === 'FAILED') {
          clearInterval(pollRef.current!); pollRef.current = null
          setPendingId(null)
          setError(data.error ?? 'Withdrawal failed')
        }
      } catch { /* retry */ }
    }
    poll()
    pollRef.current = setInterval(poll, 10_000)
  }

  const totalUsdcBalance  = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v || '0'), 0)
  const totalEurcBalance  = Object.values(eurcChainBalances).reduce((s, v) => s + parseFloat(v || '0'), 0)
  const availableBalance  = token === 'USDC' ? totalUsdcBalance : totalEurcBalance
  const amountNum         = parseFloat(amount || '0')
  const insufficientFunds = amountNum > 0 && amountNum > availableBalance
  const validAddress      = /^0x[a-fA-F0-9]{40}$/.test(address)

  const canSend = validAddress && amountNum > 0 && !insufficientFunds && !loading && !pendingId
    && planFeasible && !planLoading

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const endpoint = token === 'USDC' ? '/api/payments/aggregate-send' : '/api/payments/aggregate-send-eurc'
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipientAddress: address, amount, label: note ? `Withdrawal: ${note}` : 'Withdrawal', destChain }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Withdrawal failed')

      if (data.pending && data.paymentId) {
        setSuccess('processing')
        setPendingId(data.paymentId)
        addPending(data.paymentId)
        startPolling(data.paymentId)
      } else {
        setSuccess('processing')
      }

      setAmount(''); setAddress(''); setNote(''); setPlan(null)
      const bal = await fetch('/api/wallet/balance').then((r) => r.json())
      setChainBalances(bal.chainBalances ?? {})
      setEurcChainBalances(bal.eurcChainBalances ?? {})
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ArrowUpCircle className="h-6 w-6 text-brand-400" />
          <h1 className="text-2xl font-bold text-white">Withdraw</h1>
        </div>
        <p className="text-sm text-gray-500">Send USDC or EURC to an external wallet address</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex flex-col gap-2 rounded-xl border border-green-900/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          <div className="flex items-start gap-3">
            {pendingId
              ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>Your withdrawal is processing. Track your withdrawal status here:</span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/history?tab=withdrawals')}
            className="self-start rounded-lg border border-green-700/50 bg-green-900/40 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-800/40"
          >
            Withdrawal History →
          </button>
        </div>
      )}

      <form onSubmit={handleWithdraw} className="space-y-3">

        {/* Token toggle */}
        <div className="flex gap-1 rounded-xl border border-gray-700/60 bg-gray-800/50 p-1">
          {(['USDC', 'EURC'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setToken(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all',
                token === t ? 'bg-brand-500/15 text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-300',
              )}
            >
              <TokenLogo token={t} size={16} />{t}
            </button>
          ))}
        </div>

        {/* Section 1 — Destination chain */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel
            step={1}
            title="Destination Chain"
            subtitle="Choose which chain you want to receive funds on"
          />
          <ChainSelect
            value={destChain}
            onChange={setDestChain}
            options={(token === 'EURC' ? EURC_CHAINS : DEST_CHAINS).map((c) => ({ value: c.id, label: c.label }))}
            disabled={loading}
          />
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-800/40 bg-blue-900/15 px-3 py-2 text-xs text-blue-400">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            {token === 'USDC'
              ? 'Balances across all 5 chains are combined via CCTP and sent to this chain'
              : 'EURC balances across Arc, Ethereum, and Base are combined via CCTPx and sent to this chain'}
          </div>
        </div>

        {/* Section 2 — Destination wallet */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel step={2} title="Destination Wallet" subtitle="External wallet address to receive funds" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="0x..."
            className="w-full rounded-xl border bg-gray-800 px-3 py-2.5 font-mono text-sm text-white placeholder-gray-600 outline-none transition focus:border-brand-500/50"
            style={{ borderColor: address && !validAddress ? 'rgba(239,68,68,0.5)' : 'rgb(55,65,81)' }}
          />
          {address && !validAddress && (
            <p className="mt-1.5 text-xs text-red-400">Enter a valid 0x… wallet address</p>
          )}
        </div>

        {/* Section 3 — Amount */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel
            step={3}
            title="Amount"
            subtitle={
              token === 'USDC'
                ? `Total available: $${totalUsdcBalance.toFixed(2)} USDC across all chains`
                : `Total available: €${totalEurcBalance.toFixed(2)} EURC across Arc, Ethereum & Base`
            }
          />

          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full rounded-xl border py-3.5 pl-4 pr-20 text-xl font-semibold text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50 bg-gray-800 ${
                insufficientFunds ? 'border-red-500/60' : 'border-gray-700'
              }`}
              placeholder="0.00"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-gray-400">
              <TokenLogo token={token} size={16} />{token}
            </span>
          </div>

          {insufficientFunds && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
              Insufficient funds — max {token === 'USDC' ? `$${totalUsdcBalance.toFixed(2)}` : `€${totalEurcBalance.toFixed(2)}`} {token}
            </div>
          )}

          {amount && !insufficientFunds && (
            <button
              type="button"
              onClick={() => setAmount(availableBalance.toFixed(2))}
              className="mt-2 text-xs text-brand-400 hover:underline"
            >
              Use max ({token === 'USDC' ? `$${totalUsdcBalance.toFixed(2)}` : `€${totalEurcBalance.toFixed(2)}`} {token})
            </button>
          )}

          {/* Aggregate funding plan (USDC + EURC) */}
          {amount && parseFloat(amount) > 0 && (
            <div className="mt-4 rounded-xl border border-blue-800/50 bg-blue-900/15 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-300">
                <Layers className="h-4 w-4" /> Funding plan
              </div>
              {planLoading ? (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Computing…
                </div>
              ) : !planFeasible ? (
                <p className="text-xs text-red-400">Insufficient total balance across all chains.</p>
              ) : plan ? (
                <div className="space-y-1.5">
                  {plan.map((entry) => (
                    <div key={entry.chain} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-blue-400">
                        <ChainLogo chain={entry.chain} size={14} />
                        {entry.label}
                      </div>
                      <span className="font-medium text-blue-200">
                        {token === 'EURC' ? '€' : '$'}{parseFloat(entry.amount).toFixed(2)} {token}
                        {entry.isCctp
                          ? <span className="ml-1 text-blue-500">(~${parseFloat(entry.fee).toFixed(2)} fee)</span>
                          : <span className="ml-1 text-green-400">(instant)</span>}
                      </span>
                    </div>
                  ))}
                  {parseFloat(planFee) > 0 && (
                    <div className="mt-2 border-t border-blue-800/50 pt-2 text-xs text-blue-400">
                      Total platform fees: ~{token === 'USDC' ? '$' : ''}{parseFloat(planFee).toFixed(2)} {token}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Note */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              Note <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50"
              placeholder='e.g. "Exchange withdrawal"'
              maxLength={100}
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-800/40 bg-blue-900/15 px-4 py-3 text-sm text-blue-300">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin shrink-0" />
            {token === 'USDC' ? 'Aggregating from all chains…' : 'Initiating withdrawal…'}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading
            ? 'Processing…'
            : insufficientFunds
              ? 'Insufficient funds'
              : `Withdraw${amount ? ` ${token === 'USDC' ? `$${amount}` : `€${amount}`}` : ''} ${token}`}
        </button>
      </form>
    </div>
  )
}
