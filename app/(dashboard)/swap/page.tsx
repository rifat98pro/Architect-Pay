'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { ArrowDown, ChevronDown, Loader2, CheckCircle2, Clock, RefreshCw, Settings } from 'lucide-react'

type Direction = 'eurc-to-usdc' | 'usdc-to-eurc'
type Chain = 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA'

const CHAINS: { id: Chain; label: string; short: string; swapSupported: boolean }[] = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',  short: 'Arc Testnet', swapSupported: true  },
  { id: 'ETH-SEPOLIA',  label: 'ETH Sepolia',  short: 'ETH Sepolia', swapSupported: false },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia', short: 'Base Sepolia', swapSupported: false },
]

type BalMap = Record<Chain, { usdc: string; eurc: string }>

function ChainDropdown({
  value, onChange, tokenLabel, colorClass,
}: {
  value: Chain
  onChange: (c: Chain) => void
  tokenLabel: string
  colorClass: string
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
        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}>
          {tokenLabel[0]}
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold text-white leading-none">{tokenLabel}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{selected.short}</div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!c.swapSupported}
              onClick={() => { if (c.swapSupported) { onChange(c.id); setOpen(false) } }}
              className={`flex w-full items-center justify-between px-4 py-3 text-sm transition ${
                !c.swapSupported
                  ? 'text-gray-600 cursor-not-allowed'
                  : value === c.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{c.label}</span>
              {!c.swapSupported && <span className="text-[10px] text-gray-700 bg-gray-800 px-1.5 py-0.5 rounded">mainnet only</span>}
              {value === c.id && c.swapSupported && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
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

  const tokenIn  = direction === 'eurc-to-usdc' ? 'EURC' : 'USDC'
  const tokenOut = direction === 'eurc-to-usdc' ? 'USDC' : 'EURC'
  const inBal    = direction === 'eurc-to-usdc' ? bals[srcChain].eurc  : bals[srcChain].usdc
  const outBal   = direction === 'eurc-to-usdc' ? bals[destChain].usdc : bals[destChain].eurc

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

  const amountNum = parseFloat(amount || '0')
  const canSwap   = amountNum > 0 && amountNum <= parseFloat(inBal)

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
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-yellow-900/20 border border-yellow-900/40 px-4 py-3 text-sm text-yellow-400">
            <Clock className="h-4 w-4 shrink-0" /> Swap submitted — tokens arriving on destination chain shortly.
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
                colorClass="bg-blue-500/20 text-blue-400"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {amountNum > 0 ? `≈ $${amountNum.toFixed(2)}` : '$0.00'}
              </span>
              <button
                type="button"
                onClick={() => setAmount(inBal)}
                className="text-xs text-brand-400 hover:text-brand-300 transition"
              >
                Balance: {balLoading ? '...' : inBal} {tokenIn}
              </button>
            </div>
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
                {amountNum > 0 ? `≈ ${amountNum.toFixed(2)}` : '0'}
              </div>
              <ChainDropdown
                value={destChain}
                onChange={(c) => { setDestChain(c); setError('') }}
                tokenLabel={tokenOut}
                colorClass="bg-brand-500/20 text-brand-400"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">1:1 rate · 1% max slippage</span>
              <span className="text-xs text-gray-600">
                Balance: {balLoading ? '...' : outBal} {tokenOut}
              </span>
            </div>
          </div>

          {/* Swap button */}
          <button
            type="submit"
            disabled={loading || !canSwap}
            className="mt-3 w-full rounded-2xl bg-brand-500 py-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Swapping...</>
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
