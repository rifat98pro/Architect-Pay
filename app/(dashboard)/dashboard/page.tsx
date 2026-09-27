'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { Copy, CheckCheck, RefreshCw, ArrowDownCircle } from 'lucide-react'
import DepositModal from '@/components/deposit-modal'

const CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
  'ARB-SEPOLIA':  'Arbitrum Sepolia',
  'MATIC-AMOY':   'Polygon Amoy',
}

interface WalletData {
  address:           string
  balance:           string
  eurcBalance:       string
  eurcChainBalances: Record<string, string>
  chainBalances:     Record<string, string>
}

const EURC_CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [wallet, setWallet]            = useState<WalletData | null>(null)
  const [loading, setLoading]          = useState(true)
  const [copied, setCopied]            = useState(false)
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
    setLoading(true)
    const r    = await fetch('/api/wallet/balance')
    const data = await r.json()
    if (r.ok) setWallet(data)
    setLoading(false)
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
        <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  const total = Object.values(wallet?.chainBalances ?? {})
    .reduce((sum, b) => sum + parseFloat(b || '0'), 0)
    .toFixed(2)

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-white">Dashboard</h1>

      {/* Total balance */}
      <div
        className="card mb-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0b1e47 0%, #0b2c2c 100%)',
          border: '1px solid rgba(42,171,171,0.25)',
          boxShadow: '0 0 40px rgba(42,171,171,0.1), 0 4px 24px rgba(11,30,71,0.4)',
        }}
      >
        {/* Glow orb */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-navy-800/30 blur-2xl" />

        <div className="mb-1 text-sm font-medium text-gray-400">Total Balance (All Chains)</div>
        <div className="mb-1 text-4xl font-bold tracking-tight text-white">
          ${formatUSDC(total)}{' '}
          <span className="text-2xl font-normal text-brand-400">USDC</span>
        </div>
        {parseFloat(wallet?.eurcBalance ?? '0') > 0 && (
          <div className="mb-3 text-lg font-semibold text-blue-400">
            +{parseFloat(wallet?.eurcBalance ?? '0').toFixed(2)}{' '}
            <span className="text-base font-normal text-blue-500">EURC</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Wallet address</span>
          <span className="font-mono text-xs text-gray-300">{wallet ? truncateAddress(wallet.address, 6) : '—'}</span>
          <button onClick={copyAddress} className="rounded p-1 hover:bg-brand-500/10 text-gray-500 hover:text-brand-400 transition">
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-brand-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Per-chain USDC balances */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">USDC Balances</div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(wallet?.chainBalances ?? {}).map(([chain, bal]) => (
          <div key={chain} className="card flex items-center justify-between py-3">
            <div>
              <div className="text-xs font-medium text-gray-500">{CHAIN_LABEL[chain] ?? chain}</div>
              <div className="mt-0.5 text-lg font-semibold text-white">
                ${formatUSDC(bal)} <span className="text-sm font-normal text-gray-500">USDC</span>
              </div>
            </div>
            {chain === 'ARC-TESTNET' && (
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-500">
                Primary
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Per-chain EURC balances */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-500/70">EURC Balances</div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Object.entries(wallet?.eurcChainBalances ?? {}).map(([chain, bal]) => (
          <div
            key={chain}
            className="card flex items-center justify-between py-3"
            style={{ border: '1px solid rgba(59,130,246,0.15)' }}
          >
            <div>
              <div className="text-xs font-medium text-gray-500">{EURC_CHAIN_LABEL[chain] ?? chain}</div>
              <div className="mt-0.5 text-lg font-semibold text-white">
                {parseFloat(bal).toFixed(2)}{' '}
                <span className="text-sm font-normal text-blue-500">EURC</span>
              </div>
            </div>
            {chain === 'ARC-TESTNET' && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                Primary
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mb-8 flex gap-3">
        <button onClick={() => setDepositOpen(true)} className="btn-primary">
          <ArrowDownCircle className="h-4 w-4" />
          Deposit USDC from other chains to Arc
        </button>
        <button onClick={refresh} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">Your Wallet Address</h2>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-4 py-3 font-mono text-sm text-gray-300">
          <span className="truncate">{wallet?.address ?? 'Loading...'}</span>
          <button onClick={copyAddress} className="shrink-0 text-gray-500 hover:text-brand-500">
            {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Same address works on Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Polygon Amoy.
        </p>
      </div>

      {depositOpen && (
        <DepositModal onClose={() => setDepositOpen(false)} onSuccess={refresh} />
      )}
    </div>
  )
}
