'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { ArrowUpDown, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

type Direction = 'eurc-to-usdc' | 'usdc-to-eurc'

export default function SwapPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [direction, setDirection] = useState<Direction>('eurc-to-usdc')
  const [amount,    setAmount]    = useState('')
  const [usdcBal,   setUsdcBal]  = useState('0')
  const [eurcBal,   setEurcBal]  = useState('0')
  const [balLoading, setBalLoading] = useState(true)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function fetchBalances() {
    setBalLoading(true)
    try {
      const res  = await fetch('/api/wallet/balance')
      const data = await res.json()
      setUsdcBal(parseFloat(data.balance ?? '0').toFixed(2))
      setEurcBal(parseFloat(data.eurcBalance ?? '0').toFixed(2))
    } finally {
      setBalLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    fetchBalances()
  }, [user?.id])

  const tokenIn  = direction === 'eurc-to-usdc' ? 'EURC' : 'USDC'
  const tokenOut = direction === 'eurc-to-usdc' ? 'USDC' : 'EURC'
  const inBal    = direction === 'eurc-to-usdc' ? eurcBal : usdcBal
  const outBal   = direction === 'eurc-to-usdc' ? usdcBal : eurcBal

  function flip() {
    setDirection((d) => d === 'eurc-to-usdc' ? 'usdc-to-eurc' : 'eurc-to-usdc')
    setAmount('')
    setError('')
    setSuccess(false)
  }

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      const res  = await fetch('/api/swap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tokenIn, tokenOut, amountIn: amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Swap failed')
      setSuccess(true)
      setAmount('')
      await fetchBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setLoading(false)
    }
  }

  const amountNum   = parseFloat(amount || '0')
  const canSwap     = amountNum > 0 && amountNum <= parseFloat(inBal)

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-2xl font-bold text-white">Swap</h1>
      <p className="mb-6 text-sm text-gray-400">
        Instantly swap between USDC and EURC on Arc Testnet.
      </p>

      {/* Balance display */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {[
          { label: 'USDC Balance', value: usdcBal, color: 'text-brand-400' },
          { label: 'EURC Balance', value: eurcBal, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-bold ${color}`}>
              {balLoading ? '...' : `${value}`}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Swap completed! Your balances have been updated.
          </div>
        )}

        <form onSubmit={handleSwap} className="space-y-4">
          {/* You pay */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              You pay
              <span className="ml-2 text-xs font-normal text-gray-500">
                Available: {inBal} {tokenIn}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={inBal}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-base pr-16"
                  placeholder="0.00"
                  required
                  disabled={loading}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  {tokenIn}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAmount(inBal)}
                className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium text-brand-400 hover:bg-brand-500/10 transition"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Flip button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={flip}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 hover:border-brand-500/50 hover:text-brand-400 transition"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          {/* You receive */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              You receive
              <span className="ml-2 text-xs font-normal text-gray-500">
                Current balance: {outBal} {tokenOut}
              </span>
            </label>
            <div
              className="input-base flex items-center justify-between text-gray-500"
              style={{ cursor: 'default' }}
            >
              <span className="text-sm">
                {amountNum > 0 ? `≈ ${amountNum.toFixed(2)}` : '0.00'}
              </span>
              <span className="text-sm font-semibold">{tokenOut}</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              1:1 rate · slippage 1% max · fees included
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !canSwap}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Swapping...</>
              : <>Swap {amount ? `${amount} ` : ''}{tokenIn} → {tokenOut}</>}
          </button>
        </form>
      </div>

      <button
        onClick={fetchBalances}
        className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Refresh balances
      </button>

      <div className="mt-6 rounded-xl border border-blue-900/40 bg-blue-900/10 px-4 py-3 text-xs text-blue-400">
        <p className="font-medium mb-1">About EURC</p>
        <p className="text-blue-500">EURC is Circle&apos;s Euro-backed stablecoin. 1 EURC ≈ 1 EUR. Swaps happen on Arc Testnet via Circle&apos;s liquidity layer.</p>
      </div>
    </div>
  )
}
