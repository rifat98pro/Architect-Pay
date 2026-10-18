'use client'

import { useEffect, useRef, useState } from 'react'
import { HUB_CHAIN } from '@/lib/cctp-chains'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { ArrowDown, Loader2, CheckCircle2, Clock, RefreshCw, Settings } from 'lucide-react'
import TokenLogo from '@/components/token-logo'

type Direction = 'eurc-to-usdc' | 'usdc-to-eurc'
type Chain = 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA'

type BalMap = Record<Chain, { usdc: string; eurc: string }>

function TokenPill({ token }: { token: 'USDC' | 'EURC' }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/80 px-3 py-2.5">
      <TokenLogo token={token} size={28} />
      <div className="text-sm font-semibold leading-none text-white">{token}</div>
    </div>
  )
}

export default function SwapPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [swapForm, setSwapForm, clearSwapAmount] = useFeatureState('swap-form', {
    direction: 'eurc-to-usdc' as Direction,
    amount:    '',
    // The result of a swap belongs with the form: leaving it in local state meant
    // switching tabs mid-swap threw away the spinner and the outcome.
    loading:   false,
    pending:   false,
    success:   false,
    error:     '',
  })
  const { direction, amount, loading, pending, success, error } = swapForm
  // Swapping happens on the hub, where every balance settles. The user never picks
  // a chain here — there is only one balance per token as far as the app is concerned.
  const srcChain  = HUB_CHAIN as Chain
  const destChain = HUB_CHAIN as Chain
  const setDirection = (v: Direction)  => setSwapForm({ direction: v, amount: '' })
  const setAmount    = (v: string)     => setSwapForm({ amount: v })
  const setLoading   = (v: boolean)    => setSwapForm({ loading: v })
  const setPending   = (v: boolean)    => setSwapForm({ pending: v })
  const setSuccess   = (v: boolean)    => setSwapForm({ success: v })
  const setError     = (v: string)     => setSwapForm({ error: v })
  const BAL_CACHE_TTL  = 30_000
  const RATE_CACHE_TTL = 60_000

  const [swapCache, setSwapCache] = useFeatureState('swap-cache', {
    bals: {
      'ARC-TESTNET':  { usdc: '0', eurc: '0' },
      'ETH-SEPOLIA':  { usdc: '0', eurc: '0' },
      'BASE-SEPOLIA': { usdc: '0', eurc: '0' },
    } as BalMap,
    eurcUsd:      null as number | null,
    balFetchedAt: 0,
    rateFetchedAt: 0,
  })

  const [bals,       setBals]       = useState<BalMap>(() => swapCache.bals)
  const [eurcUsd,    setEurcUsd]    = useState<number | null>(() => swapCache.eurcUsd)
  const [rateLoading,setRateLoading]= useState(() => swapCache.rateFetchedAt === 0)
  const [balLoading, setBalLoading] = useState(() => swapCache.balFetchedAt === 0)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function fetchBalances() {
    setBalLoading(true)
    try {
      const res  = await fetch('/api/wallet/balance')
      const data = await res.json()
      const next: BalMap = {
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
      }
      setBals(next)
      setSwapCache({ bals: next, balFetchedAt: Date.now() })
    } finally {
      setBalLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    if (swapCache.balFetchedAt > 0 && Date.now() - swapCache.balFetchedAt < BAL_CACHE_TTL) {
      setBalLoading(false)
      return
    }
    fetchBalances()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    async function fetchRate() {
      setRateLoading(true)
      try {
        const res  = await fetch('/api/price')
        const data = await res.json()
        setEurcUsd(data.eurcUsd)
        setSwapCache({ eurcUsd: data.eurcUsd, rateFetchedAt: Date.now() })
      } catch { setEurcUsd(1.1) }
      finally  { setRateLoading(false) }
    }
    // Skip initial fetch if rate was recently cached
    if (swapCache.rateFetchedAt > 0 && Date.now() - swapCache.rateFetchedAt < RATE_CACHE_TTL) {
      setRateLoading(false)
    } else {
      fetchRate()
    }
    const id = setInterval(fetchRate, 60_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="mb-3 flex flex-col gap-2 rounded-xl bg-green-900/20 border border-green-900/40 px-4 py-3 text-sm text-green-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Your swap is processing. Funds will arrive shortly.
            </div>
            <button
              type="button"
              onClick={() => router.push('/history?tab=swaps')}
              className="self-start rounded-lg border border-green-700/50 bg-green-900/40 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-800/40"
            >
              Track your transaction here: History →
            </button>
          </div>
        )}
        {pending && (
          <div className="mb-3 rounded-xl bg-amber-900/20 border border-amber-800/40 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-amber-400 font-medium mb-1.5">
              <Clock className="h-4 w-4 shrink-0" /> Your swap is processing via CCTP
            </div>
            <p className="text-amber-400/80 text-xs leading-relaxed mb-2">
              Cross-chain EURC transfers take <span className="font-semibold text-amber-300">up to 15 minutes</span> to arrive on the destination chain. Your funds are safe — the transaction is being processed via CCTP.
            </p>
            <button
              type="button"
              onClick={() => router.push('/history?tab=swaps')}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
            >
              Track your transaction here: History →
            </button>
          </div>
        )}

        <form onSubmit={handleSwap}>
          {/* You pay panel */}
          <div className="rounded-2xl border border-gray-700/60 bg-gray-900/80 p-4">
            <div className="mb-3 text-xs font-medium text-gray-500">You pay</div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={loading}
                className="flex-1 bg-transparent text-3xl font-semibold text-white placeholder-gray-700 outline-none w-0 min-w-0"
              />
              <TokenPill token={tokenIn} />
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
              <TokenPill token={tokenOut} />
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
          <div className="mt-2 flex items-center justify-between rounded-xl border border-green-900/20 bg-green-900/10 px-3 py-2 text-xs text-green-500/70">
            <span>Platform fee</span>
            <span>Free</span>
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
