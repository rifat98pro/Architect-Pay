'use client'

import { useState } from 'react'
import { Shuffle, Wallet, Clock, Loader2 } from 'lucide-react'

const CHAINS = [
  { id: 'Arc_Testnet',       label: 'Arc Testnet' },
  { id: 'Ethereum_Sepolia',  label: 'Ethereum Sepolia' },
  { id: 'Base_Sepolia',      label: 'Base Sepolia' },
  { id: 'Arbitrum_Sepolia',  label: 'Arbitrum Sepolia' },
  { id: 'Avalanche_Fuji',    label: 'Avalanche Fuji' },
]

export default function BridgePage() {
  const [fromChain, setFromChain] = useState('Ethereum_Sepolia')
  const [toChain,   setToChain]   = useState('Arc_Testnet')
  const [amount,    setAmount]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

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
      setSuccess(`Bridge successful! ${data.steps?.length ?? 0} steps completed.`)
      setAmount('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bridge failed')
    } finally {
      setLoading(false)
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
              <p className="text-sm text-gray-400 mb-5">Bridge USDC across chains directly from your Architect Pay balance.</p>

              {error   && <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>}
              {success && <div className="mb-4 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400">{success}</div>}

              <form onSubmit={handleBridge} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">From</label>
                    <select value={fromChain} onChange={(e) => setFromChain(e.target.value)} className="input-base" disabled={loading}>
                      {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">To</label>
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

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  {loading ? 'Bridging...' : `Bridge ${amount ? `$${amount}` : ''} USDC`}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
