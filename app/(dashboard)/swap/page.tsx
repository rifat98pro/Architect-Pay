'use client'

import { useEffect, useRef, useState } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { ArrowDown, ChevronDown, Loader2, CheckCircle2, Clock, RefreshCw, Settings } from 'lucide-react'
import TokenLogo from '@/components/token-logo'
import ChainLogo from '@/components/chain-logo'

type Direction = 'eurc-to-usdc' | 'usdc-to-eurc'
type Chain = 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA'

const CHAINS: { id: Chain; label: string; short: string }[] = [
  { id: 'ARC-TESTNET',  label: 'Arc',      short: 'Arc'      },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum', short: 'Ethereum' },
  { id: 'BASE-SEPOLIA', label: 'Base',     short: 'Base'     },
]

type BalMap = Record<Chain, { usdc: string; eurc: string }>

function ChainDropdown({
  value, onChange, tokenLabel,
}: {
  value: Chain
  onChange: (c: Chain) => void
  tokenLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selected = CHAINS.find(c => c.id === value)!

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl bg-gray-800/80 px-3 py-2.5 hover:bg-gray-700/80 transition border border-gray-700/50"
      >
        <TokenLogo token={tokenLabel as 'USDC' | 'EURC'} size={28} />
        <div className="text-left">
          <div className="text-sm font-semibold text-white leading-none">{tokenLabel}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
            <ChainLogo chain={value} size={10} />{selected.short}
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-4 py-3 text-sm transition ${
                value === c.id ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <ChainLogo chain={c.id} size={18} />
              <span className="flex-1">{c.label}</span>
              {value === c.id && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SwapPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [swapForm, setSwapForm, clearSwapAmount] = useFeatureState('swap-form', {
    srcChain:  'ARC-TESTNET' as Chain,
    destChain: 'ARC-TESTNET' as Chain,
    direction: 'eurc-to-usdc' as Direction,
    amount:    '',
  })
  const { srcChain, destChain, direction, amount } = swapForm
  const setSrcChain  = (v: Chain)      => setSwapForm({ srcChain: v, amount: '' })
  const setDestChain = (v: Chain)      => setSwapForm({ destChain: v })
  const setDirection = (v: Direction)  => setSwapForm({ direction: v, amount: '' })
  const setAmount    = (v: string)     => setSwapForm({ amount: v })
  const [bals,       setBals]       = useState<BalMap>({
    'ARC-TESTNET':  { usdc: '0', eurc: '0' },
    'ETH-SEPOLIA':  { usdc: '0', eurc: '0' },
    'BASE-SEPOLIA': { usdc: '0', eurc: '0' },
  })
  const [eurcUsd,    setEurcUsd]    = useState<number | null>(null)
  const [rateLoading,setRateLoading]= useState(true)
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
          usdc: parseFloat(data.chainBalances?.['ARC-TESTNET']      ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['ARC-TESTNET']  ?? '0').toFixed(2),
        },
        'ETH-SEPOLIA':  {
          usdc: parseFloat(data.chainBalances?.['ETH-SEPOLIA']      ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['ETH-SEPOLIA']  ?? '0').toFixed(2),
        },
        'BASE-SEPOLIA': {
          usdc: parseFloat(data.chainBalances?.['BASE-SEPOLIA']     ?? '0').toFixed(2),
          eurc: parseFloat(data.eurcChainBalances?.['BASE-SEPOLIA'] ?? '0').toFixed(2),
        },
      })
    } finally {
      setBalLoading(false)
    }
  }

  useEffect(() => { if (user?.id) fetchBalances() }, [user?.id])

  useEffect(() => {
    async function fetchRate() {
      setRateLoading(true)
      try {
        const res  = await fetch('/api/price')
        const data = await res.json()
        setEurcUsd(data.eurcUsd)
      } catch { setEurcUsd(1.1) }
      finally  { setRateLoading(false) }
    }
    fetchRate()
    const id = setInterval(fetchRate, 60_000)
    return () => clearInterval(id)
  }, [])

  const tokenIn  = direction === 'eurc-to-usdc' ? 'EURC' : 'USDC'
  const tokenOut = direction === 'eurc-to-usdc' ? 'USDC' : 'EURC'
  const inBal    = direction === 'eurc-to-usdc' ? bals[srcChain].eurc  : bals[srcChain].usdc
  const outBal   = direction === 'eurc-to-usdc' ? bals[destChain].usdc : bals[destChain].eurc

  function flip() {
    setDirection(direction === 'eurc-to-usdc' ? 'usdc-to-eurc' : 'eurc-to-usdc')
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
      if (data.result?.pending) setPending(true)
      else setSuccess(true)
      setAmount('')
      await fetchBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setLoading(false)
    }
  }

  const amountNum      = parseFloat(amount || '0')
  const rate           = eurcUsd ?? 1.1
  const amountOut      = direction === 'eurc-to-usdc' ? amountNum * rate : amountNum / rate
  const payUsd         = direction === 'eurc-to-usdc' ? amountNum * rate : amountNum
  const inBalNum       = parseFloat(inBal)
  const insufficientFunds = amountNum > 0 && amountNum > inBalNum
  const canSwap        = amountNum > 0 && !insufficientFunds

  return (
    <div className="flex flex-col items-center pt-4">
      <div className="w-full max-w-[480px]">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between px-1">
          <h1 className="text-lg font-semibold text-white">Swap</h1>
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Status banners */}
        {error && (
          <div className="mb-3 rounded-xl bg-red-900/30 border border-red-900/50 px-4 py-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-900/20 border border-green-900/40 px-4 py-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Swap completed successfully.
          </div>
        )}
        {pending && (
          <div className="mb-3 rounded-xl bg-amber-900/20 border border-amber-800/40 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-amber-400 font-medium mb-1.5">
              <Clock className="h-4 w-4 shrink-0" /> EURC cross-chain transfer submitted
            </div>
            <p className="text-amber-400/80 text-xs leading-relaxed mb-2">
              Cross-chain EURC transfers take <span className="font-semibold text-amber-300">up to 15 minutes</span> to arrive on the destination chain. Your funds are safe — the transaction is being processed via CCTP.
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

        <form onSubmit={handleSwap}>
          {/* You pay panel */}
          <div className="rounded-2xl border border-gray-700/60 bg-gray-900/80 p-4">
            <div className="mb-3 text-xs font-medium text-gray-500">You pay</div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={loading}
                className="flex-1 bg-transparent text-3xl font-semibold text-white placeholder-gray-700 outline-none w-0 min-w-0"
              />
              <ChainDropdown
                value={srcChain}
                onChange={(c) => { setSrcChain(c); setAmount(''); setError('') }}
                tokenLabel={tokenIn}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {amountNum > 0 ? `≈ $${payUsd.toFixed(2)}` : '$0.00'}
              </span>
              <button
                type="button"
                onClick={() => setAmount(inBal)}
                className="text-xs text-brand-400 hover:text-brand-300 transition"
              >
                Balance: {balLoading ? '...' : inBal} {tokenIn}
              </button>
            </div>
            {insufficientFunds && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                Insufficient funds — max {inBal} {tokenIn}
              </div>
            )}
          </div>

          {/* Flip button */}
          <div className="relative -my-3 flex justify-center z-10">
            <button
              type="button"
              onClick={flip}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-gray-950 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition shadow-lg"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>

          {/* You receive panel */}
          <div className="rounded-2xl border border-gray-700/60 bg-gray-900/80 p-4">
            <div className="mb-3 text-xs font-medium text-gray-500">You receive</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-3xl font-semibold text-gray-400 w-0 min-w-0 truncate">
                {amountNum > 0 ? `≈ ${amountOut.toFixed(4)}` : '0'}
              </div>
              <ChainDropdown
                value={destChain}
                onChange={(c) => { setDestChain(c); setError('') }}
                tokenLabel={tokenOut}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {rateLoading
                  ? 'Fetching rate...'
                  : direction === 'eurc-to-usdc'
                    ? `1 EURC ≈ ${rate.toFixed(4)} USDC · live rate`
                    : `1 USDC ≈ ${(1 / rate).toFixed(4)} EURC · live rate`
                }
              </span>
              <span className="text-xs text-gray-600">
                Balance: {balLoading ? '...' : outBal} {tokenOut}
              </span>
            </div>
          </div>

          {/* Fee info */}
          <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
            srcChain !== destChain
              ? 'border border-amber-900/30 bg-amber-900/10 text-amber-500/80'
              : 'border border-green-900/20 bg-green-900/10 text-green-500/70'
          }`}>
            <span>Platform fee</span>
            <span>{srcChain !== destChain ? '0.01% (cross-chain)' : 'Free — same chain'}</span>
          </div>

          {/* Swap button */}
          <button
            type="submit"
            disabled={loading || !canSwap}
            className="mt-3 w-full rounded-2xl bg-brand-500 py-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Swapping...</>
              : insufficientFunds
              ? 'Insufficient funds'
              : canSwap
              ? `Swap ${amount} ${tokenIn} → ${tokenOut}`
              : 'Enter an amount'
            }
          </button>
        </form>

        <button
          onClick={fetchBalances}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition"
        >
          <RefreshCw className="h-3 w-3" /> Refresh balances
        </button>
      </div>
    </div>
  )
}
