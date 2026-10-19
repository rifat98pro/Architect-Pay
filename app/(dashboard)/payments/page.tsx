'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { usePendingPayments } from '@/context/pending-payments-context'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Loader2, AtSign, Wallet, CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import TokenLogo from '@/components/token-logo'
import ChainLogo from '@/components/chain-logo'
import ChainSelect from '@/components/chain-select'
import { cn } from '@/lib/utils'

const DEST_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc'       },
  { id: 'BASE-SEPOLIA', label: 'Base'      },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum'  },
  { id: 'MATIC-AMOY',   label: 'Polygon'   },
  { id: 'AVAX-FUJI',    label: 'Avalanche C-Chain' },
  { id: 'OP-SEPOLIA',   label: 'Optimism'  },
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
        <div className="text-sm font-semibold text-[var(--ap-text-2)]">{title}</div>
        {subtitle && <div className="text-xs text-[var(--ap-text-3)] mt-0.5">{subtitle}</div>}
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
  const [payForm, setPayForm, clearPayForm] = useFeatureState('payment-form', {
    sourceChain:        'ALL_CHAINS',
    destChain:          'BASE-SEPOLIA',
    token:              'USDC' as 'USDC' | 'EURC',
    amount:             '',
    label:              '',
    recipientMode:      'wallet' as RecipientMode,
    walletAddress:      '',
    usernameInput:      '',
    success:            '',
    confirming:         false,
    pendingPaymentId:   null as string | null,
    loading:            false,
    crossChainNotice:   false,
  })
  const { destChain, token, amount, label, recipientMode, walletAddress, usernameInput, success, confirming, pendingPaymentId, loading, crossChainNotice } = payForm
  const setDestChain        = (v: string)            => setPayForm({ destChain: v })
  const setToken            = (v: 'USDC' | 'EURC')  => setPayForm({ token: v })
  const setAmount           = (v: string)            => setPayForm({ amount: v })
  const setLabel            = (v: string)            => setPayForm({ label: v })
  const setRecipientMode    = (v: RecipientMode)     => setPayForm({ recipientMode: v, walletAddress: '', usernameInput: '' })
  const setWalletAddress    = (v: string)            => setPayForm({ walletAddress: v })
  const setUsernameInput    = (v: string)            => setPayForm({ usernameInput: v })
  const setSuccess          = (v: string)            => setPayForm({ success: v })
  const setConfirming       = (v: boolean)           => setPayForm({ confirming: v })
  const setPendingPaymentId = (v: string | null)     => setPayForm({ pendingPaymentId: v })
  const setLoading          = (v: boolean)           => setPayForm({ loading: v })
  const setCrossChainNotice = (v: boolean)           => setPayForm({ crossChainNotice: v })

  const [error, setError]   = useState('')
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  const [planLoading, setPlanLoading]   = useState(false)
  const [planFeasible, setPlanFeasible] = useState(true)
  // Quoted by the plan endpoint, never computed here — the $0.01 minimum makes a
  // naive percentage understate every small payment.
  const [quotedFee, setQuotedFee]       = useState('0')

  const [lookupState, setLookupState]         = useState<LookupState>('idle')
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [resolvedName, setResolvedName]       = useState('')
  const [resolvedImage, setResolvedImage]     = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  // Auto-dismiss success banner 5s after transfer fully completes (not while cross-chain pending)
  useEffect(() => {
    if (!success || pendingPaymentId) return
    const t = setTimeout(() => setSuccess(''), 5000)
    return () => clearTimeout(t)
  }, [success, pendingPaymentId])

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
          setResolvedImage(data.image ?? null)
        } else {
          setLookupState('notfound')
          setResolvedAddress('')
          setResolvedImage(null)
          setResolvedName('')
        }
      } catch { setLookupState('notfound') }
    }, 500)
    return () => clearTimeout(t)
  }, [usernameInput])

  const recipientAddress  = recipientMode === 'wallet' ? walletAddress : resolvedAddress
  const selectedDestChain = DEST_CHAINS.find((c) => c.id === destChain)!
  const EURC_CHAINS       = ['ARC-TESTNET', 'BASE-SEPOLIA']
  const totalBalance      = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  // Every EURC balance is spendable to every EURC destination. CCTPx quotes a zero
  // fee on any route with Arc at one end, and Arc is where every balance settles.
  const totalEurcBalance  = Object.values(eurcChainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const availableBalance  = token === 'EURC' ? totalEurcBalance.toFixed(2) : totalBalance.toFixed(2)
  const filteredDestChains = token === 'EURC' ? DEST_CHAINS.filter((c) => EURC_CHAINS.includes(c.id)) : DEST_CHAINS
  const amountNum          = parseFloat(amount || '0')
  const availableNum       = parseFloat(availableBalance)
  const insufficientFunds  = amountNum > 0 && amountNum > availableNum


  const fetchPlan = useCallback(async (amt: string, tkn: 'USDC' | 'EURC', dest: string) => {
    const n = parseFloat(amt)
    if (!n || n <= 0) { setPlanFeasible(true); return }
    setPlanLoading(true)
    try {
      const url = tkn === 'EURC'
        ? `/api/payments/aggregate-plan-eurc?amount=${n}&dest=${dest}`
        : `/api/payments/aggregate-plan?amount=${n}&dest=${dest}`
      const res  = await fetch(url)
      const data = await res.json()
      setPlanFeasible(data.feasible ?? false)
      setQuotedFee(data.quotedFee ?? '0')
    } finally { setPlanLoading(false) }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const t = setTimeout(() => fetchPlan(amount, token, destChain), 500)
    return () => clearTimeout(t)
  }, [amount, token, destChain, user?.id, fetchPlan])


  useEffect(() => {
    if (token === 'EURC' && !EURC_CHAINS.includes(destChain)) setDestChain('BASE-SEPOLIA')
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

  // Restart polling if user navigated away while a cross-chain transfer was pending
  useEffect(() => {
    if (!pendingPaymentId || pollRef.current) return
    startPolling(pendingPaymentId, crossChainNotice)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step 2: actually send after user confirms
  async function confirmSend() {
    setConfirming(false)
    setLoading(true)
    try {
      const endpoint = token === 'EURC' ? '/api/payments/aggregate-send-eurc' : '/api/payments/aggregate-send'
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipientAddress, amount, label, destChain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')

      const isEurcCrossChain = token === 'EURC'

      // Clear form fields first — success state is set after so it survives the clear
      clearPayForm(); setResolvedAddress(''); setResolvedName('')
      setLookupState('idle'); setPlanFeasible(true); setQuotedFee('0')

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
        <h1 className="text-2xl font-bold text-[var(--ap-text-1)]">Send Payment</h1>
        <p className="mt-0.5 text-sm text-[var(--ap-text-3)]">Transfer USDC or EURC across any chain · <span className="text-brand-400 font-medium">Zero gas fees</span></p>
      </div>

      <form onSubmit={handleSend} className="space-y-3">
        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="flex flex-col gap-2 rounded-xl border border-green-900/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
            <div className="flex items-start gap-3">
              {pendingPaymentId
                ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{success}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/history?tab=payments')}
              className="self-start rounded-lg border border-green-700/50 bg-green-900/40 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-800/40"
            >
              Track your transaction here: History →
            </button>
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
              onClick={() => router.push('/history?tab=payments')}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
            >
              Track your transaction here: History →
            </button>
          </div>
        )}

        {/* Section 1 — Token + Destination */}
        <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-card)] p-5">
          <SectionLabel step={1} title="Token & Destination" subtitle="Choose token type and which chain recipient gets funds on" />

          {/* Token tabs */}
          <div className="mb-4 flex gap-1 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-input-bg)] p-1">
            {(['USDC', 'EURC'] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setToken(t)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all',
                  token === t ? 'bg-brand-500/15 text-brand-400 shadow-sm' : 'text-[var(--ap-text-3)] hover:text-[var(--ap-text-2)]',
                )}
              >
                <TokenLogo token={t} size={16} />{t}
              </button>
            ))}
          </div>

          {/* Destination */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--ap-text-3)]">Recipient receives on</label>
            <ChainSelect
              value={destChain}
              onChange={setDestChain}
              disabled={loading}
              options={filteredDestChains.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>
        </div>

        {/* Section 2 — Recipient */}
        <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-card)] p-5">
          <SectionLabel step={2} title="Recipient" />

          <div className="mb-4 flex gap-1 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-input-bg)] p-1">
            {([
              { id: 'wallet',   label: 'Wallet address', icon: Wallet },
              { id: 'username', label: 'Architect Pay Username', icon: AtSign },
            ] as const).map(({ id, label: lbl, icon: Icon }) => (
              <button
                key={id} type="button" onClick={() => setRecipientMode(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                  recipientMode === id ? 'bg-brand-500/15 text-brand-400' : 'text-[var(--ap-text-3)] hover:text-[var(--ap-text-2)]',
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
              <div className="flex overflow-hidden rounded-xl border border-[var(--ap-border)] bg-[var(--ap-input-bg)] focus-within:border-brand-500/50">
                <span className="flex items-center border-r border-[var(--ap-border)] bg-[var(--ap-input-bg)] px-3 text-sm text-[var(--ap-text-3)]">@</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="flex-1 bg-transparent px-3 py-2.5 text-[var(--ap-text-1)] outline-none placeholder:text-[var(--ap-text-3)]"
                  placeholder="username"
                  autoComplete="off"
                  required
                />
              </div>
              {lookupState === 'loading' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--ap-text-3)]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking up user…
                </div>
              )}
              {lookupState === 'found' && (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/8 px-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-400 overflow-hidden">
                    {resolvedImage
                      ? <img src={resolvedImage} alt={resolvedName} className="h-full w-full object-cover" />
                      : (resolvedName?.[0]?.toUpperCase() ?? '?')
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--ap-text-1)]">{resolvedName}</span>
                      <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-400">Architect Pay</span>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-[var(--ap-text-3)]">
                      @{usernameInput} · {resolvedAddress.slice(0, 8)}…{resolvedAddress.slice(-6)}
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                </div>
              )}
              {lookupState === 'notfound' && usernameInput.length >= 3 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-900/15 px-3 py-2 text-xs text-red-400">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> No Architect Pay user found with this username
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3 — Amount */}
        <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-card)] p-5">
          <SectionLabel
            step={3}
            title="Amount"
            subtitle={`Available: ${token === 'EURC' ? '' : '$'}${availableBalance} ${token}`}
          />

          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full rounded-xl border py-3.5 pl-4 pr-20 text-xl font-semibold text-[var(--ap-text-1)] outline-none placeholder:text-[var(--ap-text-3)] focus:border-brand-500/50 bg-[var(--ap-input-bg)] ${
                insufficientFunds ? 'border-red-500/60' : 'border-[var(--ap-border)]'
              }`}
              placeholder="0.00"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--ap-text-3)]">
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

          {/* Optional label */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[var(--ap-text-3)]">
              Note <span className="text-[var(--ap-text-3)]">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-[var(--ap-border)] bg-[var(--ap-input-bg)] px-4 py-2.5 text-sm text-[var(--ap-text-1)] outline-none placeholder:text-[var(--ap-text-3)] focus:border-brand-500/50"
              placeholder='e.g. "March salary"'
              maxLength={100}
            />
          </div>
        </div>

        {/* Cross-chain progress */}
        {loading && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-800/40 bg-blue-900/15 px-4 py-3 text-sm text-blue-300">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin shrink-0" />
            Initiating cross-chain transfer…
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !canSend || !amount || insufficientFunds || !planFeasible || planLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ShieldCheck className="h-4 w-4" />}
          {loading
            ? 'Sending…'
            : insufficientFunds
              ? 'Insufficient funds'
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
              background: 'var(--ap-modal)',
              border:     '1px solid rgba(42,171,171,0.2)',
              boxShadow:  'var(--ap-modal-shadow)',
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15">
                <ShieldCheck className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--ap-text-1)]">Confirm Transaction</h3>
                <p className="text-xs text-[var(--ap-text-3)]">Double-check before sending</p>
              </div>
            </div>

            <div className="mb-5 space-y-3 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-input-bg)] p-4">
              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--ap-text-3)]">Amount</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ap-text-1)]">
                  <TokenLogo token={token} size={16} />
                  {token === 'EURC' ? '' : '$'}{amount} {token}
                </span>
              </div>

              {/* Route */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--ap-text-3)] shrink-0">Route</span>
                <span className="flex items-center justify-end gap-1 text-xs text-[var(--ap-text-2)] flex-wrap">
                  to <ChainLogo chain={destChain} size={13} />{selectedDestChain.label}
                </span>
              </div>

              {/* Fee */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--ap-text-3)]">Fee</span>
                <span className="text-xs text-amber-400">
                  {token === 'EURC' ? '' : '$'}{parseFloat(quotedFee).toFixed(2)} {token}
                </span>
              </div>


              {/* Label */}
              {label && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--ap-text-3)]">Note</span>
                  <span className="text-xs text-[var(--ap-text-2)]">{label}</span>
                </div>
              )}

              {/* Divider */}
              <div className="my-1 border-t border-[var(--ap-border)]" />

              {/* Recipient — full address highlighted */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Recipient address — verify carefully
                </div>
                <div className="select-all break-all rounded-lg border border-amber-600/50 bg-[#1c0f00] px-3 py-2.5 font-mono text-xs leading-relaxed text-amber-200">
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
                className="flex-1 rounded-xl border border-[var(--ap-border)] py-2.5 text-sm font-medium text-[var(--ap-text-3)] hover:bg-[var(--ap-row-hover)] transition"
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
