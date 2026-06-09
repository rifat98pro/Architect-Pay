'use client'

import { useState, useEffect } from 'react'
import { Shuffle, Wallet, Clock, Loader2 } from 'lucide-react'

const CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet' },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia' },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia' },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy' },
]

export default function BridgePage() {
  const [fromChain, setFromChain] = useState('ETH-SEPOLIA')
  const [toChain,   setToChain]   = useState('ARC-TESTNET')
  const [amount,    setAmount]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [balances,   setBalances]   = useState<Record<string, string>>({})
  const [balLoading, setBalLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const [recoverMsg, setRecoverMsg] = useState('')

  useEffect(() => {
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((data) => {
        if (data.chainBalances) setBalances(data.chainBalances)
      })
      .catch(() => {})
      .finally(() => setBalLoading(false))
  }, [])

  function balanceFor(chainId: string) {
    const val = balances[chainId]
    if (balLoading) return '...'
    if (!val || val === '0') return '0.00'
    return parseFloat(val).toFixed(2)
  }

  async function handleBridge(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res  = await fetch('/api/bridge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, fromChain, toChain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bridge failed')
      setSuccess(data.message ?? 'Bridge successful!')
      setAmount('')
      // Refresh balances after bridge
      fetch('/api/wallet/balance')
        .then((r) => r.json())
        .then((data) => { if (data.chainBalances) setBalances(data.chainBalances) })
        .catch(() => {})
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bridge failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecover() {
    setRecoverMsg('')
    setError('')
    setRecovering(true)
    try {
      const res  = await fetch('/api/bridge/recover', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Recovery failed')
      const recovered = data.results?.filter((r: { status: string }) => r.status === 'recovered') ?? []
      const pending   = data.results?.filter((r: { status: string }) => r.status.startsWith('attestation_pending')) ?? []
      if (data.results?.length === 0) {
        setRecoverMsg('No pending transfers found.')
      } else if (recovered.length > 0) {
        setRecoverMsg(`Recovered ${recovered.length} transfer(s)! USDC is now in your Arc Testnet wallet.`)
        fetch('/api/wallet/balance').then(r => r.json()).then(d => { if (d.chainBalances) setBalances(d.chainBalances) }).catch(() => {})
      } else if (pending.length > 0) {
        setRecoverMsg('Transfer found but attestation is not ready yet. Try again in a few minutes.')
      } else {
        setRecoverMsg(data.message ?? 'No action taken.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Recovery failed')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Bridge</h1>
      <p className="text-gray-400 mb-8">Move tokens seamlessly across networks.</p>

      <div className="space-y-4">

        {/* DeFi Wallet Bridge - Coming Soon */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
              <Wallet className="h-5 w-5 text-brand-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-base font-semibold text-white">DeFi Wallet Bridge</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                  <Clock className="h-3 w-3" />
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-gray-400">Connect your MetaMask or any DeFi wallet and bridge tokens across chains using integrated bridge protocols.</p>
            </div>
          </div>
        </div>

        {/* Architect Pay Wallet Bridge - Live */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
              <Shuffle className="h-5 w-5 text-brand-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white mb-1">Architect Pay Wallet Bridge</h2>
              <p className="text-sm text-gray-400 mb-4">Bridge USDC across chains directly from your Architect Pay balance.</p>

              {/* Chain Balances */}
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CHAINS.map((c) => (
                  <div key={c.id} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
                    <p className="text-xs text-gray-400 truncate">{c.label}</p>
                    <p className="text-sm font-semibold text-white">
                      {balLoading ? (
                        <span className="text-gray-500">...</span>
                      ) : (
                        <>{balanceFor(c.id)} <span className="text-xs font-normal text-gray-400">USDC</span></>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {error     && <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>}
              {success   && <div className="mb-4 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400">{success}</div>}
              {recoverMsg && <div className="mb-4 rounded-lg bg-brand-500/10 px-4 py-3 text-sm text-brand-500">{recoverMsg}</div>}

              <form onSubmit={handleBridge} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      From <span className="text-brand-500">{balanceFor(fromChain)} USDC</span>
                    </label>
                    <select value={fromChain} onChange={(e) => setFromChain(e.target.value)} className="input-base" disabled={loading}>
                      {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      To <span className="text-brand-500">{balanceFor(toChain)} USDC</span>
                    </label>
                    <select value={toChain} onChange={(e) => setToChain(e.target.value)} className="input-base" disabled={loading}>
                      {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Amount (USDC)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input-base pl-7"
                      placeholder="0.00"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading || recovering} className="btn-primary w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  {loading ? 'Bridging...' : `Bridge ${amount ? `$${amount}` : ''} USDC`}
                </button>
              </form>

              <div className="mt-3 border-t border-gray-800 pt-3">
                <p className="mb-2 text-xs text-gray-500">Missing USDC from a previous bridge? Recover it here.</p>
                <button
                  type="button"
                  onClick={handleRecover}
                  disabled={recovering || loading}
                  className="btn-secondary w-full text-sm"
                >
                  {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {recovering ? 'Scanning for pending transfers...' : 'Recover Pending Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
