'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { Copy, CheckCheck, RefreshCw, ArrowDownCircle, TrendingUp, Layers, Wallet, CreditCard } from 'lucide-react'
import DepositModal from '@/components/deposit-modal'
import OnrampModal from '@/components/onramp-modal'
import { useTheme } from '@/context/theme-context'
import TokenLogo from '@/components/token-logo'
import ChainLogo from '@/components/chain-logo'

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


export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [wallet, setWallet]            = useState<WalletData | null>(null)
  const [loading, setLoading]          = useState(true)
  const [copied, setCopied]            = useState(false)
  const [refreshing, setRefreshing]    = useState(false)
  const [depositOpen,   setDepositOpen]   = useState(false)
  const [onrampOpen,    setOnrampOpen]    = useState(false)
  const [mainnetNotice, setMainnetNotice] = useState(false)
  const { theme } = useTheme()

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
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            style={{
              borderColor: theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)',
              background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
              color:       theme === 'light' ? '#324862' : '#8faab8',
            }}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setMainnetNotice(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 hover:bg-brand-400 transition"
          >
            <CreditCard className="h-4 w-4 shrink-0 text-navy-950" />
            <div className="text-left">
              <div className="text-xs font-bold text-navy-950 leading-tight">Deposit Funds</div>
              <div className="text-[10px] font-medium text-navy-950/70 leading-tight">Debit Card · Apple Pay · Google Pay</div>
            </div>
          </button>
          <button
            onClick={() => setDepositOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
            style={{ background: 'rgba(18,32,49,0.6)' }}
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
          style={theme === 'light' ? {
            background: '#ffffff',
            border:     '1px solid rgba(42,171,171,0.25)',
            boxShadow:  '0 2px 12px rgba(42,171,171,0.08)',
          } : {
            background: 'linear-gradient(135deg, #0b1e47 0%, #091a30 100%)',
            border:     '1px solid rgba(42,171,171,0.2)',
            boxShadow:  '0 0 40px rgba(42,171,171,0.07)',
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <TokenLogo token="USDC" size={28} />
            <span className="text-sm font-medium" style={{ color: theme === 'light' ? '#45607a' : '#8faab8' }}>Total USDC</span>
          </div>
          <div className="text-3xl font-bold tracking-tight" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>
            ${formatUSDC(totalUsdc)}
            <span className="ml-2 text-base font-normal text-brand-400">USDC</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>Across all chains</div>
        </div>

        {/* EURC total */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={theme === 'light' ? {
            background: '#ffffff',
            border:     '1px solid rgba(59,130,246,0.25)',
            boxShadow:  '0 2px 12px rgba(59,130,246,0.08)',
          } : {
            background: 'linear-gradient(135deg, #0b1836 0%, #0c142b 100%)',
            border:     '1px solid rgba(59,130,246,0.2)',
            boxShadow:  '0 0 40px rgba(59,130,246,0.06)',
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <TokenLogo token="EURC" size={28} />
            <span className="text-sm font-medium" style={{ color: theme === 'light' ? '#45607a' : '#8faab8' }}>Total EURC</span>
          </div>
          <div className="text-3xl font-bold tracking-tight" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>
            {parseFloat(totalEurc).toFixed(2)}
            <span className="ml-2 text-base font-normal text-blue-400">EURC</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>Unified Euro stablecoin</div>
        </div>
      </div>

      {/* USDC per-chain */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">USDC by All Supported Chains</span>
          <div className="flex-1 h-px" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Object.entries(wallet?.chainBalances ?? {}).map(([chain, bal]) => (
            <div
              key={chain}
              className="flex items-center justify-between rounded-xl border px-4 py-3.5 transition"
              style={{
                background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
                borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center gap-3">
                <ChainLogo chain={chain} size={28} />
                <div>
                  <div className="text-sm font-medium" style={{ color: theme === 'light' ? '#0b1e47' : '#c5d3ed' }}>{CHAIN_LABEL[chain] ?? chain}</div>
                  {chain === 'ARC-TESTNET' && (
                    <div className="text-xs text-brand-500">Primary</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>${formatUSDC(bal)}</div>
                <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                  <TokenLogo token="USDC" size={12} />USDC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EURC per-chain */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-500/70">EURC by All Supported Chains</span>
          <div className="flex-1 h-px" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {Object.entries(wallet?.eurcChainBalances ?? {}).map(([chain, bal]) => (
            <div
              key={chain}
              className="flex items-center justify-between rounded-xl border px-4 py-3.5"
              style={{
                background:  theme === 'light' ? '#eef4ff' : 'rgba(30,58,138,0.12)',
                borderColor: theme === 'light' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
              }}
            >
              <div className="flex items-center gap-3">
                <ChainLogo chain={chain} size={28} />
                <div className="text-sm font-medium" style={{ color: theme === 'light' ? '#1e3a8a' : '#93c5fd' }}>{EURC_CHAIN_LABEL[chain] ?? chain}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: theme === 'light' ? '#1e3a8a' : '#ffffff' }}>{parseFloat(bal).toFixed(2)}</div>
                <div className="flex items-center justify-end gap-1 text-xs text-blue-500">
                  <TokenLogo token="EURC" size={12} />EURC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet address */}
      <div className="rounded-2xl border p-4" style={{ background: theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.4)', borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)' }}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <Wallet className="h-3.5 w-3.5" />
          Wallet Address
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: theme === 'light' ? '#f0f4f8' : 'rgba(18,32,49,0.6)' }}>
          <span className="truncate font-mono text-sm" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>{wallet?.address ?? '—'}</span>
          <button
            onClick={copyAddress}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:text-brand-400 transition"
          >
            {copied ? <CheckCheck className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Same address on Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Polygon Amoy.
        </p>
      </div>

      {depositOpen && (
        <DepositModal onClose={() => setDepositOpen(false)} onSuccess={refresh} username={user?.username ?? ''} />
      )}
      {onrampOpen && (
        <OnrampModal onClose={() => setOnrampOpen(false)} onSuccess={refresh} />
      )}
      {mainnetNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMainnetNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{
              background: 'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
              border:     '1px solid rgba(42,171,171,0.2)',
              boxShadow:  '0 24px 64px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15">
                <CreditCard className="h-6 w-6 text-brand-400" />
              </div>
            </div>
            <h3 className="mb-2 text-base font-bold text-white">Coming to Mainnet</h3>
            <p className="mb-5 text-sm text-gray-400 leading-relaxed">
              Deposit Funds from Debit card, Apple Pay, or Google Pay will be available on mainnet.
            </p>
            <button
              onClick={() => setMainnetNotice(false)}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
