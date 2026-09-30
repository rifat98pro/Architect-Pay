'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePendingPayments } from '@/context/pending-payments-context'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Send, Loader2, Layers, AtSign, Wallet, CheckCircle2, XCircle, ChevronDown, ArrowRight, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import TokenLogo from '@/components/token-logo'
import { cn } from '@/lib/utils'
import type { AggregatePlanEntry } from '@/lib/aggregate'

const SOURCE_CHAINS = [
  { id: 'ALL_CHAINS',   label: 'All Chains (Aggregate)', instant: false },
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',            instant: true  },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia',       instant: false },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia',            instant: false },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia',        instant: false },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy',            instant: false },
]

const DEST_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet'      },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia'      },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia' },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy'     },
]

type RecipientMode = 'wallet' | 'username'
type LookupState   = 'idle' | 'loading' | 'found' | 'notfound'

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

export default function PaymentsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { addPending }                 = usePendingPayments()

  const [chainBalances, setChainBalances]         = useState<Record<string, string>>({})
  const [eurcChainBalances, setEurcChainBalances] = useState<Record<string, string>>({})
  const [sourceChain, setSourceChain]             = useState('ARC-TESTNET')
  const [destChain, setDestChain]                 = useState('ARC-TESTNET')
  const [token, setToken]                         = useState<'USDC' | 'EURC'>('USDC')
  const [amount, setAmount]                       = useState('')
  const [label, setLabel]                         = useState('')
  const [loading, setLoading]                     = useState(false)
  const [error, setError]                         = useState('')
  const [success, setSuccess]                     = useState('')
  const [crossChainNotice, setCrossChainNotice]   = useState(false)
  const [confirming, setConfirming]               = useState(false)
  const [pendingPaymentId, setPendingPaymentId]   = useState<string | null>(null)
  const pollRef                                   = useRef<ReturnType<typeof setInterval> | null>(null)

  const [planLoading, setPlanLoading]   = useState(false)
  const [plan, setPlan]                 = useState<AggregatePlanEntry[] | null>(null)
  const [planFeasible, setPlanFeasible] = useState(true)
  const [planFee, setPlanFee]           = useState('0')

  const [recipientMode, setRecipientMode]     = useState<RecipientMode>('wallet')
  const [walletAddress, setWalletAddress]     = useState('')
  const [usernameInput, setUsernameInput]     = useState('')
  const [lookupState, setLookupState]         = useState<LookupState>('idle')
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [resolvedName, setResolvedName]       = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((data) => {
        setChainBalances(data.chainBalances ?? {})
        setEurcChainBalances(data.eurcChainBalances ?? {})
      })
  }, [user?.id])

  useEffect(() => {
    const raw = usernameInput.trim().replace(/^@/, '')
    if (!raw || raw.length < 3) { setLookupState('idle'); setResolvedAddress(''); setResolvedName(''); return }
    setLookupState('loading')
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/users/lookup?username=${encodeURIComponent(raw)}`)
        const data = await res.json()
        if (res.ok && data.found) {
          setLookupState('found')
          setResolvedAddress(data.walletAddress)
          setResolvedName(data.displayName)
        } else {
          setLookupState('notfound')
          setResolvedAddress('')
          setResolvedName('')
        }
      } catch { setLookupState('notfound') }
    }, 500)
    return () => clearTimeout(t)
  }, [usernameInput])

  const recipientAddress = recipientMode === 'wallet' ? walletAddress : resolvedAddress
  const isAggregate       = sourceChain === 'ALL_CHAINS'
  const isCrossChain      = !isAggregate && (sourceChain !== destChain)
  const selectedSrcChain  = SOURCE_CHAINS.find((c) => c.id === sourceChain)!
  const selectedDestChain = DEST_CHAINS.find((c) => c.id === destChain)!
  const EURC_CHAINS       = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA']
  const eurcSrcBlocked    = token === 'EURC' && isCrossChain && !EURC_CHAINS.includes(sourceChain)
  const totalBalance      = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const availableBalance  = isAggregate
    ? totalBalance.toFixed(2)
    : token === 'EURC'
      ? parseFloat(eurcChainBalances[sourceChain] ?? '0').toFixed(2)
      : parseFloat(chainBalances[sourceChain] ?? '0').toFixed(2)
  const filteredDestChains  = token === 'EURC' ? DEST_CHAINS.filter((c) => EURC_CHAINS.includes(c.id)) : DEST_CHAINS
  const amountNum           = parseFloat(amount || '0')
  const availableNum        = parseFloat(availableBalance)
  const insufficientFunds   = amountNum > 0 && amountNum > availableNum

  const fetchPlan = useCallback(async (amt: string) => {
    const n = parseFloat(amt)
    if (!n || n <= 0) { setPlan(null); return }
    setPlanLoading(true)
    try {
      const res  = await fetch(`/api/payments/aggregate-plan?amount=${n}`)
      const data = await res.json()
      setPlan(data.plan ?? null)
      setPlanFeasible(data.feasible ?? false)
      setPlanFee(data.totalFee ?? '0')
    } finally { setPlanLoading(false) }
  }, [])

  useEffect(() => {
    if (!isAggregate || !user) { setPlan(null); return }
    const t = setTimeout(() => fetchPlan(amount), 500)
    return () => clearTimeout(t)
  }, [isAggregate, amount, user, fetchPlan])

  useEffect(() => {
    if (sourceChain === 'ALL_CHAINS') setDestChain('ARC-TESTNET')
  }, [sourceChain])

  useEffect(() => {
    if (token === 'EURC') {
      if (!EURC_CHAINS.includes(destChain))   setDestChain('ARC-TESTNET')
      if (!EURC_CHAINS.includes(sourceChain)) setSourceChain('ARC-TESTNET')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const canSend = recipientMode === 'wallet'
    ? /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
    : lookupState === 'found'

  // Step 1: show confirmation screen
  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setError('')
    setSuccess('')
    setCrossChainNotice(false)
    setConfirming(true)
  }

  // Poll the mint endpoint every 10 seconds until COMPLETED
  function startPolling(paymentId: string, isEurcCrossChain: boolean) {
    if (pollRef.current) clearInterval(pollRef.current)

    const poll = async () => {
      try {
        const res  = await fetch(`/api/payments/${paymentId}/mint`, { method: 'POST' })
        const data = await res.json()
        if (data.status === 'COMPLETED') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setPendingPaymentId(null)
          setSuccess('Transfer completed successfully!')
          if (isEurcCrossChain) setCrossChainNotice(false)
          const bal = await fetch('/api/wallet/balance').then((r) => r.json())
          setChainBalances(bal.chainBalances ?? {})
          setEurcChainBalances(bal.eurcChainBalances ?? {})
        } else if (data.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setPendingPaymentId(null)
          setError(data.error ?? 'Transfer failed')
        }
      } catch { /* retry next tick */ }
    }

    poll() // immediate first check
    pollRef.current = setInterval(poll, 10_000)
  }

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Step 2: actually send after user confirms
  async function confirmSend() {
    setConfirming(false)
    setLoading(true)
    try {
      const endpoint = isAggregate ? '/api/payments/aggregate-send' : '/api/payments/send'
      const body     = isAggregate
        ? { recipientAddress, amount, label }
        : { recipientAddress, amount, label, sourceChain, destChain, token }
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')

      const isEurcCrossChain = token === 'EURC' && (isCrossChain || isAggregate)

      if (data.pending && data.paymentId) {
        // Cross-chain: burn done, minting in progress — poll until complete (globally, survives navigation)
        setSuccess(`${amount} ${token} transfer initiated! Completing on destination chain…`)
        setCrossChainNotice(isEurcCrossChain)
        setPendingPaymentId(data.paymentId)
        addPending(data.paymentId)
        startPolling(data.paymentId, isEurcCrossChain)
      } else {
        setSuccess(`${amount} ${token} sent successfully!`)
      }

      setWalletAddress(''); setUsernameInput(''); setResolvedAddress(''); setResolvedName('')
      setLookupState('idle'); setAmount(''); setLabel(''); setPlan(null)
      const bal = await fetch('/api/wallet/balance').then((r) => r.json())
      setChainBalances(bal.chainBalances ?? {})
      setEurcChainBalances(bal.eurcChainBalances ?? {})
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Send Payment</h1>
        <p className="mt-0.5 text-sm text-gray-500">Transfer USDC or EURC across any chain</p>
      </div>

      <form onSubmit={handleSend} className="space-y-3">
        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-900/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
            {pendingPaymentId
              ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {success}
          </div>
        )}
        {crossChainNotice && (
          <div className="rounded-xl border border-amber-800/40 bg-amber-900/20 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-1.5">
              <Clock className="h-4 w-4 shrink-0" /> EURC cross-chain transfer in progress
            </div>
            <p className="text-xs text-amber-400/80 leading-relaxed mb-2.5">
              Cross-chain EURC transfers can take <span className="font-semibold text-amber-300">up to 15 minutes</span> to arrive on the destination chain. Your funds are safe and being processed via CCTP.
            </p>
            <button
              type="button"
              onClick={() => router.push('/history')}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
            >
              Track in History →
            </button>
          </div>
        )}

        {/* Section 1 — Chain + Token */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel step={1} title="Route & Token" subtitle="Choose source chain, destination, and token type" />

          {/* Token tabs */}
          {!isAggregate && (
            <div className="mb-4 flex gap-1 rounded-xl border border-gray-700/60 bg-gray-800/50 p-1">
              {(['USDC', 'EURC'] as const).map((t) => (
                <button
                  key={t} type="button" onClick={() => setToken(t)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all',
                    token === t ? 'bg-brand-500/15 text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  <TokenLogo token={t} size={16} />{t}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Source */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">From</label>
              <div className="relative">
                <select
                  value={sourceChain}
                  onChange={(e) => { setSourceChain(e.target.value); setPlan(null) }}
                  className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-800 py-2.5 pl-3 pr-8 text-sm text-white outline-none focus:border-brand-500/50 disabled:opacity-50"
                  disabled={loading}
                >
                  {SOURCE_CHAINS
                    .filter((c) => token === 'EURC' ? c.id !== 'ALL_CHAINS' && EURC_CHAINS.includes(c.id) : true)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id === 'ALL_CHAINS'
                          ? `All — $${totalBalance.toFixed(2)}`
                          : token === 'EURC'
                            ? `${c.label} (${parseFloat(eurcChainBalances[c.id] ?? '0').toFixed(2)} EURC)`
                            : `${c.label} ($${parseFloat(chainBalances[c.id] ?? '0').toFixed(2)})`}
                      </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            {/* Destination */}
            {!isAggregate && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">To</label>
                <div className="relative">
                  <select
                    value={destChain}
                    onChange={(e) => setDestChain(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-800 py-2.5 pl-3 pr-8 text-sm text-white outline-none focus:border-brand-500/50 disabled:opacity-50"
                    disabled={loading}
                  >
                    {filteredDestChains.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            )}
          </div>

          {/* Route hint */}
          {!isAggregate && (
            <div className={cn(
              'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
              eurcSrcBlocked
                ? 'border border-red-900/40 bg-red-900/20 text-red-400'
                : isCrossChain
                  ? 'border border-amber-900/40 bg-amber-900/20 text-amber-400'
                  : 'border border-green-900/30 bg-green-900/15 text-green-400',
            )}>
              {eurcSrcBlocked ? (
                <><XCircle className="h-3.5 w-3.5 shrink-0" /> EURC cross-chain not supported from this chain</>
              ) : isCrossChain ? (
                <><ArrowRight className="h-3.5 w-3.5 shrink-0" /> Cross-chain via CCTP · {selectedSrcChain.label} → {selectedDestChain.label} · ~2–3 min · ~1% fee</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Same-chain — instant, no fees</>
              )}
            </div>
          )}

          {isAggregate && (
            <p className="mt-3 text-xs text-blue-400">
              Combines balances across all chains via CCTP, then transfers in one shot.
            </p>
          )}
        </div>

        {/* Section 2 — Recipient */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel step={2} title="Recipient" />

          <div className="mb-4 flex gap-1 rounded-xl border border-gray-700/60 bg-gray-800/50 p-1">
            {([
              { id: 'wallet',   label: 'Wallet address', icon: Wallet },
              { id: 'username', label: '@username',       icon: AtSign },
            ] as const).map(({ id, label: lbl, icon: Icon }) => (
              <button
                key={id} type="button" onClick={() => setRecipientMode(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                  recipientMode === id ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <Icon className="h-3.5 w-3.5" />{lbl}
              </button>
            ))}
          </div>

          {recipientMode === 'wallet' ? (
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="input-base font-mono text-sm"
              placeholder="0x..."
              pattern="^0x[a-fA-F0-9]{40}$"
              required
            />
          ) : (
            <div>
              <div className="flex overflow-hidden rounded-xl border border-gray-700 bg-gray-800 focus-within:border-brand-500/50">
                <span className="flex items-center border-r border-gray-700 bg-gray-800/70 px-3 text-sm text-gray-500">@</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="flex-1 bg-transparent px-3 py-2.5 text-white outline-none placeholder:text-gray-600"
                  placeholder="username"
                  autoComplete="off"
                  required
                />
              </div>
              {lookupState === 'loading' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking up user…
                </div>
              )}
              {lookupState === 'found' && (
                <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-green-900/40 bg-green-900/15 px-3 py-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                  <span className="font-semibold text-green-300">{resolvedName}</span>
                  <span className="font-mono text-gray-500">{resolvedAddress.slice(0, 8)}…{resolvedAddress.slice(-6)}</span>
                </div>
              )}
              {lookupState === 'notfound' && usernameInput.length >= 3 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-900/15 px-3 py-2 text-xs text-red-400">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> User not found or has no wallet yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3 — Amount */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-5">
          <SectionLabel
            step={3}
            title="Amount"
            subtitle={`Available: ${token === 'EURC' ? '' : '$'}${availableBalance} ${token}`}
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
              Insufficient funds — max {token === 'EURC' ? '' : '$'}{availableBalance} {token}
            </div>
          )}

          {amount && !insufficientFunds && (
            <button
              type="button"
              onClick={() => setAmount(availableBalance)}
              className="mt-2 text-xs text-brand-400 hover:underline"
            >
              Use max ({token === 'EURC' ? '' : '$'}{availableBalance})
            </button>
          )}

          {/* Aggregate plan */}
          {isAggregate && amount && parseFloat(amount) > 0 && (
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
                      <span className="text-blue-400">{entry.label}</span>
                      <span className="font-medium text-blue-200">
                        ${parseFloat(entry.amount).toFixed(2)} USDC
                        {entry.isCctp && <span className="ml-1 text-blue-500">(~${parseFloat(entry.fee).toFixed(2)} fee)</span>}
                        {!entry.isCctp && <span className="ml-1 text-green-400">(instant)</span>}
                      </span>
                    </div>
                  ))}
                  {parseFloat(planFee) > 0 && (
                    <div className="mt-2 border-t border-blue-800/50 pt-2 text-xs text-blue-400">
                      Total CCTP fees: ~${parseFloat(planFee).toFixed(2)} USDC
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Optional label */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              Note <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50"
              placeholder='e.g. "March salary"'
              maxLength={100}
            />
          </div>
        </div>

        {/* Cross-chain progress */}
        {loading && (isCrossChain || isAggregate) && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-800/40 bg-blue-900/15 px-4 py-3 text-sm text-blue-300">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin shrink-0" />
            Initiating cross-chain transfer…
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !canSend || !amount || eurcSrcBlocked || insufficientFunds || (isAggregate && (!planFeasible || planLoading))}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ShieldCheck className="h-4 w-4" />}
          {loading
            ? 'Sending…'
            : insufficientFunds
              ? 'Insufficient funds'
              : isAggregate
                ? `Review & Send${amount ? ` $${amount}` : ''} USDC`
                : `Review & Send ${amount ? (token === 'EURC' ? amount : `$${amount}`) : ''} ${token}`}
        </button>
      </form>

      {/* ── Confirmation modal ── */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: 'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
              border:     '1px solid rgba(42,171,171,0.2)',
              boxShadow:  '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15">
                <ShieldCheck className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Confirm Transaction</h3>
                <p className="text-xs text-gray-500">Double-check before sending</p>
              </div>
            </div>

            <div className="mb-5 space-y-3 rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Amount</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <TokenLogo token={token} size={16} />
                  {token === 'EURC' ? '' : '$'}{amount} {token}
                </span>
              </div>

              {/* Route */}
              {!isAggregate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Route</span>
                  <span className="text-xs text-gray-300">
                    {selectedSrcChain.label}
                    {isCrossChain && <> <ArrowRight className="inline h-3 w-3" /> {selectedDestChain.label}</>}
                  </span>
                </div>
              )}
              {isAggregate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Route</span>
                  <span className="text-xs text-gray-300">All Chains (Aggregate)</span>
                </div>
              )}

              {/* Fee */}
              {isCrossChain && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Platform fee (0.1%)</span>
                  <span className="text-xs text-amber-400">
                    ~{token === 'EURC' ? '' : '$'}{Math.max(parseFloat(amount || '0') * 0.001, 0.10).toFixed(2)} {token}
                  </span>
                </div>
              )}

              {/* Label */}
              {label && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Note</span>
                  <span className="text-xs text-gray-300">{label}</span>
                </div>
              )}

              {/* Divider */}
              <div className="my-1 border-t border-gray-700" />

              {/* Recipient — full address highlighted */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  Recipient address — verify carefully
                </div>
                <div className="break-all rounded-lg border border-amber-900/40 bg-amber-900/10 px-3 py-2 font-mono text-xs text-amber-200">
                  {recipientAddress}
                </div>
                {resolvedName && (
                  <div className="mt-1 text-xs text-green-400">{resolvedName}</div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 transition"
              >
                Go Back
              </button>
              <button
                onClick={confirmSend}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
