'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { Copy, CheckCheck, RefreshCw, ArrowDownCircle, TrendingUp, Layers, Wallet } from 'lucide-react'
import DepositModal from '@/components/deposit-modal'

const CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
  'ARB-SEPOLIA':  'Arbitrum Sepolia',
  'MATIC-AMOY':   'Polygon Amoy',
}

const EURC_CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
}

interface WalletData {
  address:           string
  balance:           string
  eurcBalance:       string
  eurcChainBalances: Record<string, string>
  chainBalances:     Record<string, string>
}

const CHAIN_DOTS: Record<string, string> = {
  'ARC-TESTNET':  '#2aabab',
  'ETH-SEPOLIA':  '#627eea',
  'BASE-SEPOLIA': '#0052ff',
  'ARB-SEPOLIA':  '#12aaff',
  'MATIC-AMOY':   '#8247e5',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [wallet, setWallet]            = useState<WalletData | null>(null)
  const [loading, setLoading]          = useState(true)
  const [copied, setCopied]            = useState(false)
  const [refreshing, setRefreshing]    = useState(false)
  const [depositOpen, setDepositOpen]  = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/wallet/balance')
      .then(async (r) => { const data = await r.json(); if (r.ok) setWallet(data) })
      .finally(() => setLoading(false))
  }, [user?.id])

  async function refresh() {
    setRefreshing(true)
    const r    = await fetch('/api/wallet/balance')
    const data = await r.json()
    if (r.ok) setWallet(data)
    setRefreshing(false)
  }

  function copyAddress() {
    if (!wallet) return
    navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading && !wallet) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-brand-500" />
      </div>
    )
  }

  const totalUsdc = Object.values(wallet?.chainBalances ?? {})
    .reduce((sum, b) => sum + parseFloat(b || '0'), 0)
    .toFixed(2)
  const totalEurc = parseFloat(wallet?.eurcBalance ?? '0').toFixed(2)

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Your multi-chain wallet overview</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setDepositOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition"
          >
            <ArrowDownCircle className="h-4 w-4" />
            Deposit
          </button>
        </div>
      </div>

      {/* Hero balance cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* USDC total */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background:  'linear-gradient(135deg, #0b1e47 0%, #091a30 100%)',
            border:      '1px solid rgba(42,171,171,0.2)',
            boxShadow:   '0 0 40px rgba(42,171,171,0.07)',
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15">
              <TrendingUp className="h-4 w-4 text-brand-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Total USDC</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">
            ${formatUSDC(totalUsdc)}
            <span className="ml-2 text-base font-normal text-brand-400">USDC</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Across all chains</div>
        </div>

        {/* EURC total */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background:  'linear-gradient(135deg, #0b1836 0%, #0c142b 100%)',
            border:      '1px solid rgba(59,130,246,0.2)',
            boxShadow:   '0 0 40px rgba(59,130,246,0.06)',
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
              <Layers className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Total EURC</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">
            {parseFloat(totalEurc).toFixed(2)}
            <span className="ml-2 text-base font-normal text-blue-400">EURC</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Unified Euro stablecoin</div>
        </div>
      </div>

      {/* USDC per-chain */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">USDC by Chain</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Object.entries(wallet?.chainBalances ?? {}).map(([chain, bal]) => (
            <div
              key={chain}
              className="flex items-center justify-between rounded-xl border border-gray-700/50 bg-gray-900/60 px-4 py-3.5 transition hover:border-gray-600"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: CHAIN_DOTS[chain] ?? '#6b7280', boxShadow: `0 0 6px ${CHAIN_DOTS[chain] ?? '#6b7280'}60` }}
                />
                <div>
                  <div className="text-sm font-medium text-gray-200">{CHAIN_LABEL[chain] ?? chain}</div>
                  {chain === 'ARC-TESTNET' && (
                    <div className="text-xs text-brand-500">Primary</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">${formatUSDC(bal)}</div>
                <div className="text-xs text-gray-500">USDC</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EURC per-chain */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-500/70">EURC by Chain</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {Object.entries(wallet?.eurcChainBalances ?? {}).map(([chain, bal]) => (
            <div
              key={chain}
              className="flex items-center justify-between rounded-xl border border-blue-900/30 bg-blue-950/20 px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: CHAIN_DOTS[chain] ?? '#6b7280', boxShadow: `0 0 6px ${CHAIN_DOTS[chain] ?? '#6b7280'}60` }}
                />
                <div className="text-sm font-medium text-gray-300">{EURC_CHAIN_LABEL[chain] ?? chain}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{parseFloat(bal).toFixed(2)}</div>
                <div className="text-xs text-blue-500">EURC</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet address */}
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <Wallet className="h-3.5 w-3.5" />
          Wallet Address
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-800/60 px-4 py-3">
          <span className="truncate font-mono text-sm text-gray-300">{wallet?.address ?? '—'}</span>
          <button
            onClick={copyAddress}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-700 hover:text-brand-400 transition"
          >
            {copied ? <CheckCheck className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Same address on Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Polygon Amoy.
        </p>
      </div>

      {depositOpen && (
        <DepositModal onClose={() => setDepositOpen(false)} onSuccess={refresh} />
      )}
    </div>
  )
}
