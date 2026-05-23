'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Send, Loader2, Layers } from 'lucide-react'
import type { AggregatePlanEntry } from '@/app/api/payments/aggregate-plan/route'

const CHAINS = [
  { id: 'ALL_CHAINS',   label: 'All Chains (Aggregate)', instant: false },
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',            instant: true  },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia',       instant: false },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia',            instant: false },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia',        instant: false },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy',            instant: false },
]

export default function PaymentsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [chainBalances, setChainBalances] = useState<Record<string, string>>({})
  const [sourceChain, setSourceChain]     = useState('ARC-TESTNET')
  const [address, setAddress]             = useState('')
  const [amount, setAmount]               = useState('')
  const [label, setLabel]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  // Aggregate plan state
  const [planLoading, setPlanLoading]     = useState(false)
  const [plan, setPlan]                   = useState<AggregatePlanEntry[] | null>(null)
  const [planFeasible, setPlanFeasible]   = useState(true)
  const [planFee, setPlanFee]             = useState('0')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((data) => setChainBalances(data.chainBalances ?? {}))
  }, [user])

  const isAggregate     = sourceChain === 'ALL_CHAINS'
  const isCrossChain    = !isAggregate && sourceChain !== 'ARC-TESTNET'
  const selectedChain   = CHAINS.find((c) => c.id === sourceChain)!

  const totalBalance    = Object.values(chainBalances).reduce((s, v) => s + parseFloat(v), 0)
  const availableBalance = isAggregate
    ? totalBalance.toFixed(2)
    : parseFloat(chainBalances[sourceChain] ?? '0').toFixed(2)

  // Fetch aggregate plan when in aggregate mode and amount is valid
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const endpoint = isAggregate ? '/api/payments/aggregate-send' : '/api/payments/send'
      const body     = isAggregate
        ? { recipientAddress: address, amount, label }
        : { recipientAddress: address, amount, label, sourceChain }

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')

      setSuccess(`${amount} USDC sent successfully!`)
      setAddress('')
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
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Send Payment</h1>
      <p className="mb-6 text-sm text-gray-500">
        Recipient always receives USDC on Arc Testnet.
      </p>

      <div className="card">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
        )}

        <form onSubmit={handleSend} className="space-y-5">

          {/* Source chain */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Pay from
            </label>
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
              <p className="mt-1.5 text-xs text-blue-600">
                Combines balances from all chains. CCTP pulls run in parallel, then one final transfer to the recipient.
              </p>
            )}
            {isCrossChain && (
              <p className="mt-1.5 text-xs text-amber-600">
                Cross-chain via CCTP — takes ~2–3 minutes. A small relayer fee (~1%) applies. USDC burns on {selectedChain.label} and mints on Arc Testnet for the recipient.
              </p>
            )}
          </div>

          {/* Recipient */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Recipient wallet address (Arc Testnet)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-base font-mono"
              placeholder="0x..."
              pattern="^0x[a-fA-F0-9]{40}$"
              title="Must be a valid EVM address (0x...)"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Amount (USDC)
              <span className="ml-2 text-xs font-normal text-gray-400">
                Available: ${availableBalance}
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Aggregate plan preview */}
          {isAggregate && amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-800">
                <Layers className="h-4 w-4" />
                Funding plan
              </div>
              {planLoading ? (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Computing...
                </div>
              ) : !planFeasible ? (
                <p className="text-xs text-red-600">Insufficient total balance across all chains.</p>
              ) : plan ? (
                <div className="space-y-1.5">
                  {plan.map((entry) => (
                    <div key={entry.chain} className="flex items-center justify-between text-xs">
                      <span className="text-blue-700">{entry.label}</span>
                      <span className="font-medium text-blue-900">
                        ${parseFloat(entry.amount).toFixed(2)} USDC
                        {entry.isCctp && (
                          <span className="ml-1 text-blue-500">(~${parseFloat(entry.fee).toFixed(2)} fee)</span>
                        )}
                        {!entry.isCctp && <span className="ml-1 text-green-600">(instant)</span>}
                      </span>
                    </div>
                  ))}
                  {parseFloat(planFee) > 0 && (
                    <div className="mt-2 border-t border-blue-200 pt-2 text-xs text-blue-600">
                      Total CCTP fees: ~${parseFloat(planFee).toFixed(2)} USDC
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Label <span className="text-gray-400">(optional)</span>
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
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
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
            disabled={loading || (isAggregate && (!planFeasible || planLoading))}
            className="btn-primary w-full"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isAggregate ? <Layers className="h-4 w-4" /> : <Send className="h-4 w-4" />
            }
            {loading
              ? 'Sending...'
              : isAggregate
                ? `Aggregate & Send ${amount ? `$${amount}` : ''} USDC`
                : `Send ${amount ? `$${amount}` : ''} USDC`
            }
          </button>
        </form>
      </div>
    </div>
  )
}
