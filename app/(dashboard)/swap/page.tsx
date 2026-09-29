'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { ArrowUpDown, ArrowRight, Loader2, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

type Direction = 'eurc-to-usdc' | 'usdc-to-eurc'
type Chain = 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA'

const CHAINS: { id: Chain; label: string; short: string }[] = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',  short: 'Arc'  },
  { id: 'ETH-SEPOLIA',  label: 'ETH Sepolia',  short: 'ETH'  },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia', short: 'Base' },
]

type BalMap = Record<Chain, { usdc: string; eurc: string }>

export default function SwapPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [srcChain,   setSrcChain]   = useState<Chain>('ARC-TESTNET')
  const [destChain,  setDestChain]  = useState<Chain>('ARC-TESTNET')
  const [direction,  setDirection]  = useState<Direction>('eurc-to-usdc')
  const [amount,     setAmount]     = useState('')
  const [bals,       setBals]       = useState<BalMap>({
    'ARC-TESTNET':  { usdc: '0', eurc: '0' },
    'ETH-SEPOLIA':  { usdc: '0', eurc: '0' },
    'BASE-SEPOLIA': { usdc: '0', eurc: '0' },
  })
  const [balLoading, setBalLoading] = useState(true)
  const [loading,    setLoading]    = useState(false)
  const [pending,    setPending]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function fetchBalances() {
    setBalLoading(true)
    try {
      const res  = await fetch('/api/wallet/balance')
      const data = await res.json()
      setBals({
        'ARC-TESTNET':  {
          usdc: parseFloat(data.chainBalances?.['ARC-TESTNET']       ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['ARC-TESTNET']   ?? '0').toFixed(2),
        },
        'ETH-SEPOLIA':  {
          usdc: parseFloat(data.chainBalances?.['ETH-SEPOLIA']       ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['ETH-SEPOLIA']   ?? '0').toFixed(2),
        },
        'BASE-SEPOLIA': {
          usdc: parseFloat(data.chainBalances?.['BASE-SEPOLIA']      ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['BASE-SEPOLIA']  ?? '0').toFixed(2),
        },
      })
    } finally {
      setBalLoading(false)
    }
  }

  useEffect(() => { if (user?.id) fetchBalances() }, [user?.id])

  const tokenIn  = direction === 'eurc-to-usdc' ? 'EURC' : 'USDC'
  const tokenOut = direction === 'eurc-to-usdc' ? 'USDC' : 'EURC'
  const inBal    = direction === 'eurc-to-usdc' ? bals[srcChain].eurc  : bals[srcChain].usdc
  const outBal   = direction === 'eurc-to-usdc' ? bals[destChain].usdc : bals[destChain].eurc

  const isCrossChain = srcChain !== destChain

  function flip() {
    setDirection((d) => d === 'eurc-to-usdc' ? 'usdc-to-eurc' : 'eurc-to-usdc')
    setAmount('')
    setError('')
    setSuccess(false)
    setPending(false)
  }

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setPending(false)
    setLoading(true)
    try {
      const res  = await fetch('/api/swap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tokenIn, tokenOut, amountIn: amount, srcChain, destChain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Swap failed')
      if (data.result?.pending) {
        setPending(true)
      } else {
        setSuccess(true)
      }
      setAmount('')
      await fetchBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setLoading(false)
    }
  }

  const amountNum = parseFloat(amount || '0')
  const canSwap   = amountNum > 0 && amountNum <= parseFloat(inBal)

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-2xl font-bold text-white">Swap</h1>
      <p className="mb-6 text-sm text-gray-400">
        Swap USDC ↔ EURC on the same chain or across chains.
      </p>

      {/* Chain selectors */}
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Source chain */}
        <div>
          <p className="mb-1 text-xs text-gray-500">From</p>
          <div className="flex flex-col gap-1">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSrcChain(c.id); setAmount(''); setError(''); setSuccess(false); setPending(false) }}
                className={`rounded-lg px-3 py-2 text-xs font-medium text-left transition ${
                  srcChain === c.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <span>{c.label}</span>
                <span className={`ml-1 ${srcChain === c.id ? 'text-white/70' : 'text-gray-600'}`}>
                  {balLoading ? '' : `${bals[c.id][tokenIn === 'EURC' ? 'eurc' : 'usdc']} ${tokenIn}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-gray-600 mt-5" />

        {/* Destination chain */}
        <div>
          <p className="mb-1 text-xs text-gray-500">To</p>
          <div className="flex flex-col gap-1">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setDestChain(c.id); setError(''); setSuccess(false); setPending(false) }}
                className={`rounded-lg px-3 py-2 text-xs font-medium text-left transition ${
                  destChain === c.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <span>{c.label}</span>
                <span className={`ml-1 ${destChain === c.id ? 'text-white/70' : 'text-gray-600'}`}>
                  {balLoading ? '' : `${bals[c.id][tokenOut === 'USDC' ? 'usdc' : 'eurc']} ${tokenOut}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {isCrossChain && (
        <div className="mb-4 rounded-lg border border-yellow-800/40 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-400">
          Cross-chain swap — may take a few minutes to arrive on the destination chain.
        </div>
      )}

      <div className="card">
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Swap completed! Balances updated.
          </div>
        )}
        {pending && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-900/20 px-4 py-3 text-sm text-yellow-400">
            <Clock className="h-4 w-4 shrink-0" />
            Swap submitted — cross-chain delivery in progress. Check your destination wallet in a few minutes.
          </div>
        )}

        <form onSubmit={handleSwap} className="space-y-4">
          {/* You pay */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              You pay
              <span className="ml-2 text-xs font-normal text-gray-500">
                Available: {inBal} {tokenIn} on {CHAINS.find(c => c.id === srcChain)?.short}
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

          {/* Flip tokens button */}
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
                Balance: {outBal} {tokenOut} on {CHAINS.find(c => c.id === destChain)?.short}
              </span>
            </label>
            <div className="input-base flex items-center justify-between text-gray-500" style={{ cursor: 'default' }}>
              <span className="text-sm">{amountNum > 0 ? `≈ ${amountNum.toFixed(2)}` : '0.00'}</span>
              <span className="text-sm font-semibold">{tokenOut}</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">1:1 rate · slippage 1% max · fees included</p>
          </div>

          <button
            type="submit"
            disabled={loading || !canSwap}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {isCrossChain ? 'Submitting cross-chain swap...' : 'Swapping...'}</>
              : <>Swap {amount ? `${amount} ` : ''}{tokenIn} → {tokenOut}{isCrossChain ? ` (${CHAINS.find(c=>c.id===srcChain)?.short} → ${CHAINS.find(c=>c.id===destChain)?.short})` : ''}</>
            }
          </button>
        </form>
      </div>

      <button
        onClick={fetchBalances}
        className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Refresh balances
      </button>
    </div>
  )
}
