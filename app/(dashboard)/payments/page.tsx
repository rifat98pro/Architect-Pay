'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Send, Loader2, Layers, AtSign, Wallet, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AggregatePlanEntry } from '@/lib/aggregate'

const CHAINS = [
  { id: 'ALL_CHAINS',   label: 'All Chains (Aggregate)', instant: false },
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',            instant: true  },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia',       instant: false },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia',            instant: false },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia',        instant: false },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy',            instant: false },
]

type RecipientMode = 'wallet' | 'username'
type LookupState   = 'idle' | 'loading' | 'found' | 'notfound'

export default function PaymentsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [chainBalances, setChainBalances] = useState<Record<string, string>>({})
  const [sourceChain, setSourceChain]     = useState('ARC-TESTNET')
  const [amount, setAmount]               = useState('')
  const [label, setLabel]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  const [planLoading, setPlanLoading]     = useState(false)
  const [plan, setPlan]                   = useState<AggregatePlanEntry[] | null>(null)
  const [planFeasible, setPlanFeasible]   = useState(true)
  const [planFee, setPlanFee]             = useState('0')

  // Recipient
  const [recipientMode, setRecipientMode]       = useState<RecipientMode>('wallet')
  const [walletAddress, setWalletAddress]       = useState('')
  const [usernameInput, setUsernameInput]       = useState('')
  const [lookupState, setLookupState]           = useState<LookupState>('idle')
  const [resolvedAddress, setResolvedAddress]   = useState('')
  const [resolvedName, setResolvedName]         = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((data) => setChainBalances(data.chainBalances ?? {}))
  }, [user?.id])

  // Username lookup (debounced)
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
      } catch {
        setLookupState('notfound')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [usernameInput])

  const recipientAddress = recipientMode === 'wallet' ? walletAddress : resolvedAddress

  const isAggregate   = sourceChain === 'ALL_CHAINS'
  const isCrossChain  = !isAggregate && sourceChain !== 'ARC-TESTNET'
  const selectedChain = CHAINS.find((c) => c.id === sourceChain)!
  const totalBalance  = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const availableBalance = isAggregate
    ? totalBalance.toFixed(2)
    : parseFloat(chainBalances[sourceChain] ?? '0').toFixed(2)

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
    } finally {
      setPlanLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAggregate || !user) { setPlan(null); return }
    const t = setTimeout(() => fetchPlan(amount), 500)
    return () => clearTimeout(t)
  }, [isAggregate, amount, user, fetchPlan])

  const canSend = recipientMode === 'wallet'
    ? /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
    : lookupState === 'found'

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const endpoint = isAggregate ? '/api/payments/aggregate-send' : '/api/payments/send'
      const body     = isAggregate
        ? { recipientAddress, amount, label }
        : { recipientAddress, amount, label, sourceChain }

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')

      setSuccess(`${amount} USDC sent successfully!`)
      setWalletAddress('')
      setUsernameInput('')
      setResolvedAddress('')
      setResolvedName('')
      setLookupState('idle')
      setAmount('')
      setLabel('')
      setPlan(null)

      const bal = await fetch('/api/wallet/balance').then((r) => r.json())
      setChainBalances(bal.chainBalances ?? {})
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-2xl font-bold text-white">Send Payment</h1>
      <p className="mb-6 text-sm text-gray-400">
        Recipient always receives USDC on Arc Testnet.
      </p>

      <div className="card">
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400">{success}</div>
        )}

        <form onSubmit={handleSend} className="space-y-5">

          {/* Source chain */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Pay from</label>
            <select
              value={sourceChain}
              onChange={(e) => { setSourceChain(e.target.value); setPlan(null) }}
              className="input-base"
              disabled={loading}
            >
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === 'ALL_CHAINS'
                    ? `All Chains — $${totalBalance.toFixed(2)} USDC total`
                    : `${c.label} — $${parseFloat(chainBalances[c.id] ?? '0').toFixed(2)} USDC`}
                </option>
              ))}
            </select>
            {isAggregate && (
              <p className="mt-1.5 text-xs text-blue-400">
                Combines balances from all chains. CCTP pulls run in parallel, then one final transfer to the recipient.
              </p>
            )}
            {isCrossChain && (
              <p className="mt-1.5 text-xs text-amber-400">
                Cross-chain via CCTP — takes ~2–3 minutes. A small relayer fee (~1%) applies. USDC burns on {selectedChain.label} and mints on Arc Testnet for the recipient.
              </p>
            )}
          </div>

          {/* Recipient */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Send to</label>

            {/* Mode toggle */}
            <div
              className="mb-3 flex gap-1 rounded-xl p-1"
              style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.12)' }}
            >
              <button
                type="button"
                onClick={() => setRecipientMode('wallet')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                  recipientMode === 'wallet' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <Wallet className="h-3.5 w-3.5" />
                Web3 Wallet
              </button>
              <button
                type="button"
                onClick={() => setRecipientMode('username')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                  recipientMode === 'username' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <AtSign className="h-3.5 w-3.5" />
                Architect Pay User
              </button>
            </div>

            {recipientMode === 'wallet' ? (
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="input-base font-mono"
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                title="Must be a valid EVM address (0x...)"
                required
              />
            ) : (
              <div>
                <div className="flex items-center input-base overflow-hidden p-0">
                  <span className="flex h-full items-center px-3 text-sm text-gray-500 border-r border-gray-700 bg-gray-800/50">@</span>
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

                {/* Lookup feedback */}
                {lookupState === 'loading' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking up user...
                  </div>
                )}
                {lookupState === 'found' && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-900/20 px-3 py-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    <span className="font-medium text-green-300">{resolvedName}</span>
                    <span className="text-gray-500 font-mono">{resolvedAddress.slice(0, 8)}…{resolvedAddress.slice(-6)}</span>
                  </div>
                )}
                {lookupState === 'notfound' && usernameInput.length >= 3 && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-900/20 px-3 py-2 text-xs text-red-400">
                    <XCircle className="h-3.5 w-3.5 shrink-0" /> User not found or has no wallet yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Amount (USDC)
              <span className="ml-2 text-xs font-normal text-gray-500">
                Available: ${availableBalance}
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base pr-8"
                placeholder="0.00"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            </div>
          </div>

          {/* Aggregate plan */}
          {isAggregate && amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-300">
                <Layers className="h-4 w-4" /> Funding plan
              </div>
              {planLoading ? (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Computing...
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
                    <div className="mt-2 border-t border-blue-800 pt-2 text-xs text-blue-400">
                      Total CCTP fees: ~${parseFloat(planFee).toFixed(2)} USDC
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Label <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input-base"
              placeholder='e.g. "Alice – March salary"'
              maxLength={100}
            />
          </div>

          {loading && (isCrossChain || isAggregate) && (
            <div className="rounded-lg bg-blue-900/20 px-4 py-3 text-sm text-blue-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {isAggregate
                  ? <span>Aggregating from multiple chains via CCTP (~2–3 min per chain, running in parallel), then sending to recipient. Do not close this window.</span>
                  : <span>Cross-chain transfer in progress (~2–3 min): approving → burning → attesting → minting on Arc. Do not close this window.</span>
                }
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canSend || !amount || (isAggregate && (!planFeasible || planLoading))}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isAggregate ? <Layers className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {loading
              ? 'Sending...'
              : isAggregate
                ? `Aggregate & Send ${amount ? `$${amount}` : ''} USDC`
                : `Send ${amount ? `$${amount}` : ''} USDC`}
          </button>
        </form>
      </div>
    </div>
  )
}
