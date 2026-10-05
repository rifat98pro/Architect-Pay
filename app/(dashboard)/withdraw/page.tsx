'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { usePendingPayments } from '@/context/pending-payments-context'
import { ArrowUpCircle, Loader2, CheckCircle2, XCircle, Send } from 'lucide-react'
import TokenLogo from '@/components/token-logo'
import ChainSelect from '@/components/chain-select'

const CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet'      },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia'      },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia' },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy'     },
]

const EURC_CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA']

export default function WithdrawPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { addPending } = usePendingPayments()

  const [chainBalances, setChainBalances]         = useState<Record<string, string>>({})
  const [eurcChainBalances, setEurcChainBalances] = useState<Record<string, string>>({})

  const [sourceChain, setSourceChain] = useState('ARC-TESTNET')
  const [destChain,   setDestChain]   = useState('ARC-TESTNET')
  const [token,       setToken]       = useState<'USDC' | 'EURC'>('USDC')
  const [amount,      setAmount]      = useState('')
  const [address,     setAddress]     = useState('')
  const [note,        setNote]        = useState('')

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

  // Auto-dismiss success banner 5s after complete
  useEffect(() => {
    if (!success || pendingId) return
    const t = setTimeout(() => setSuccess(''), 5000)
    return () => clearTimeout(t)
  }, [success, pendingId])

  // Restrict EURC to supported chains
  useEffect(() => {
    if (token === 'EURC') {
      if (!EURC_CHAINS.includes(sourceChain)) setSourceChain('ARC-TESTNET')
      if (!EURC_CHAINS.includes(destChain))   setDestChain('ARC-TESTNET')
    }
  }, [token])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Resume polling on page load if a cross-chain withdraw was pending
  useEffect(() => {
    if (!pendingId || pollRef.current) return
    startPolling(pendingId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      } catch { /* retry next tick */ }
    }
    poll()
    pollRef.current = setInterval(poll, 10_000)
  }

  const isCrossChain    = sourceChain !== destChain
  const filteredChains  = token === 'EURC' ? CHAINS.filter((c) => EURC_CHAINS.includes(c.id)) : CHAINS
  const availableBalance = token === 'EURC'
    ? parseFloat(eurcChainBalances[sourceChain] ?? '0').toFixed(2)
    : parseFloat(chainBalances[sourceChain] ?? '0').toFixed(2)
  const amountNum        = parseFloat(amount || '0')
  const insufficientFunds = amountNum > 0 && amountNum > parseFloat(availableBalance)
  const validAddress     = /^0x[a-fA-F0-9]{40}$/.test(address)
  const canSend          = validAddress && amountNum > 0 && !insufficientFunds && !loading && !pendingId

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res  = await fetch('/api/payments/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recipientAddress: address,
          amount,
          label:      note || 'Withdrawal',
          sourceChain,
          destChain,
          token,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Withdrawal failed')

      if (data.pending && data.paymentId) {
        setSuccess(`${amount} ${token} withdrawal initiated! Completing on destination chain…`)
        setPendingId(data.paymentId)
        addPending(data.paymentId)
        startPolling(data.paymentId)
      } else {
        setSuccess(`${amount} ${token} withdrawn successfully!`)
      }

      setAmount('')
      setAddress('')
      setNote('')
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
        <div className="flex items-start gap-3 rounded-xl border border-green-900/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {pendingId
            ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          {success}
        </div>
      )}

      <form onSubmit={handleWithdraw} className="space-y-5">
        {/* Token */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'rgba(18,32,49,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Token</div>
          <div className="flex gap-2">
            {(['USDC', 'EURC'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition"
                style={{
                  background:   token === t ? 'rgba(42,171,171,0.12)' : 'transparent',
                  borderColor:  token === t ? 'rgba(42,171,171,0.4)'  : 'rgba(255,255,255,0.08)',
                  color:        token === t ? '#2aabab'                : '#8faab8',
                }}
              >
                <TokenLogo token={t} size={18} />
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Chains */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'rgba(18,32,49,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Route</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-xs text-gray-500">From</div>
              <ChainSelect
                value={sourceChain}
                onChange={setSourceChain}
                chains={filteredChains}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs text-gray-500">To</div>
              <ChainSelect
                value={destChain}
                onChange={setDestChain}
                chains={filteredChains}
              />
            </div>
          </div>
          {isCrossChain && (
            <div className="mt-3 text-xs text-gray-500">
              Cross-chain · ~2–3 min · ~0.01% fee
            </div>
          )}
        </div>

        {/* Destination address */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'rgba(18,32,49,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Destination Wallet</div>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="0x..."
            className="w-full rounded-xl border bg-transparent px-3 py-2.5 font-mono text-sm text-white placeholder-gray-600 outline-none transition"
            style={{ borderColor: address && !validAddress ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)' }}
          />
          {address && !validAddress && (
            <p className="mt-1.5 text-xs text-red-400">Enter a valid 0x… wallet address</p>
          )}
        </div>

        {/* Amount */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'rgba(18,32,49,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</div>
            <button
              type="button"
              onClick={() => setAmount(availableBalance)}
              className="text-xs text-brand-400 hover:text-brand-300 transition"
            >
              Max: {availableBalance} {token}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: insufficientFunds ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent text-lg font-semibold text-white placeholder-gray-600 outline-none"
            />
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-400">
              <TokenLogo token={token} size={16} />
              {token}
            </div>
          </div>
          {insufficientFunds && (
            <p className="mt-1.5 text-xs text-red-400">Insufficient balance</p>
          )}
        </div>

        {/* Optional note */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'rgba(18,32,49,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Note (optional)</div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Exchange withdrawal"
            className="w-full rounded-xl border border-white/8 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? 'Processing…' : 'Withdraw'}
        </button>
      </form>
    </div>
  )
}
