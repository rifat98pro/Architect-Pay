'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, CreditCard, Rocket, Building2, Users, Banknote, X } from 'lucide-react'
import DepositModal from '@/components/deposit-modal'
import OnrampModal from '@/components/onramp-modal'
import { useTheme } from '@/context/theme-context'
import TokenLogo from '@/components/token-logo'
import ChainLogo from '@/components/chain-logo'

const CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc',
  'ETH-SEPOLIA':  'Ethereum',
  'BASE-SEPOLIA': 'Base',
  'ARB-SEPOLIA':  'Arbitrum',
  'MATIC-AMOY':   'Polygon',
  'AVAX-FUJI':    'Avalanche',
  'OP-SEPOLIA':   'Optimism',
}

const EURC_CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc',
  'ETH-SEPOLIA':  'Ethereum',
  'BASE-SEPOLIA': 'Base',
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
  const [refreshing, setRefreshing]    = useState(false)
  const [depositOpen,   setDepositOpen]   = useState(false)
  const [onrampOpen,    setOnrampOpen]    = useState(false)
  const [mainnetNotice, setMainnetNotice] = useState(false)
  const [welcomeOpen,   setWelcomeOpen]   = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    try {
      if (!localStorage.getItem('ap_mainnet_welcomed')) {
        setWelcomeOpen(true)
      }
    } catch { /* private browsing */ }
  }, [])

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
          <button
            onClick={() => router.push('/withdraw')}
            className="flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
            style={{ background: 'rgba(18,32,49,0.6)' }}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Withdraw
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
          <div className="mt-1 text-xs" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>Unified USDC balance</div>
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
            €{parseFloat(totalEurc).toFixed(2)}
            <span className="ml-2 text-base font-normal text-blue-400">EURC</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>Unified EURC balance</div>
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
                <div className="text-sm font-semibold" style={{ color: theme === 'light' ? '#1e3a8a' : '#ffffff' }}>€{parseFloat(bal).toFixed(2)}</div>
                <div className="flex items-center justify-end gap-1 text-xs text-blue-500">
                  <TokenLogo token="EURC" size={12} />EURC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {depositOpen && (
        <DepositModal onClose={() => setDepositOpen(false)} onSuccess={refresh} />
      )}
      {onrampOpen && (
        <OnrampModal onClose={() => setOnrampOpen(false)} onSuccess={refresh} />
      )}
      {/* Welcome to Mainnet modal — shown once per browser */}
      {welcomeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="relative w-full max-w-md rounded-3xl p-8"
            style={{
              background: 'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
              border:     '1px solid rgba(42,171,171,0.25)',
              boxShadow:  '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(42,171,171,0.1)',
            }}
          >
            <button
              onClick={() => { setWelcomeOpen(false); try { localStorage.setItem('ap_mainnet_welcomed', '1') } catch {} }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Badge */}
            <div className="mb-5 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold" style={{ borderColor: 'rgba(42,171,171,0.3)', background: 'rgba(42,171,171,0.08)', color: '#2aabab' }}>
                <Rocket className="h-3.5 w-3.5" />
                Now Live on Mainnet
              </div>
            </div>

            <h2 className="mb-2 text-center text-2xl font-bold text-white">Welcome to Architect Pay</h2>
            <p className="mb-7 text-center text-sm leading-relaxed text-gray-400">
              Real USDC and EURC. Real payments. Multi-chain payroll — no crypto knowledge needed.
            </p>

            {/* Steps */}
            <div className="mb-7 space-y-3">
              {[
                { icon: <ArrowDownCircle className="h-4 w-4" />, step: '1', title: 'Fund your wallet', desc: 'Deposit USDC or EURC from any supported chain into your Arc wallet.' },
                { icon: <Building2 className="h-4 w-4" />,       step: '2', title: 'Create a business & add employees', desc: 'Set up your company, add team members with wallet addresses and salaries.' },
                { icon: <Banknote className="h-4 w-4" />,        step: '3', title: 'Run payroll or send payments', desc: 'Pay everyone in one click. Cross-chain, instant, on-chain proof.' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-brand-400" style={{ background: 'rgba(42,171,171,0.12)' }}>
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-gray-500">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setWelcomeOpen(false); try { localStorage.setItem('ap_mainnet_welcomed', '1') } catch {} }}
              className="w-full rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ background: '#2aabab', boxShadow: '0 0 24px rgba(42,171,171,0.3)' }}
            >
              Get Started
            </button>
          </div>
        </div>
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
