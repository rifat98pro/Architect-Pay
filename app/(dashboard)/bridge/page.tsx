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

        