'use client'

import { useEffect, useState } from 'react'
import { X, Copy, CheckCheck, AlertTriangle, AtSign, ChevronDown } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import ChainLogo from '@/components/chain-logo'
import TokenLogo from '@/components/token-logo'

const USDC_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet',       network: 'Arc Testnet' },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum',           network: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base',               network: 'Base Sepolia' },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum',           network: 'Arbitrum Sepolia' },
  { id: 'MATIC-AMOY',   label: 'Polygon',            network: 'Polygon Amoy' },
]

const EURC_CHAINS = [
  { id: 'ARC-TESTNET',  label: 'Arc Testnet', network: 'Arc Testnet' },
  { id: 'ETH-SEPOLIA',  label: 'Ethereum',    network: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base',        network: 'Base Sepolia' },
]

export default function DepositModal({
  onClose,
  onSuccess: _onSuccess,
}: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const [address,        setAddress]        = useState<string | null>(null)
  const [username,       setUsername]       = useState<string | null>(null)
  const [copied,         setCopied]         = useState(false)
  const [copiedUsername, setCopiedUsername] = useState(false)
  const [token,          setToken]          = useState<'USDC' | 'EURC'>('USDC')
  const [chainId,        setChainId]        = useState('ARC-TESTNET')

  const chains        = token === 'EURC' ? EURC_CHAINS : USDC_CHAINS
  const selectedChain = chains.find((c) => c.id === chainId) ?? chains[0]

  useEffect(() => {
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((d) => { if (d.address) setAddress(d.address) })
    fetch('/api/account/settings')
      .then((r) => r.json())
      .then((d) => { if (d.user?.username) setUsername(d.user.username) })
  }, [])

  // Reset chain when token changes if current chain unsupported
  useEffect(() => {
    if (!chains.find((c) => c.id === chainId)) setChainId('ARC-TESTNET')
  }, [token, chains, chainId])

  function copy() {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyUsername() {
    if (!username) return
    navigator.clipboard.writeText(username)
    setCopiedUsername(true)
    setTimeout(() => setCopiedUsername(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background:  'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
          border:      '1px solid rgba(42,171,171,0.18)',
          boxShadow:   '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Deposit</h2>
            <p className="text-xs text-gray-500">Send tokens to your wallet address below</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1 — Token */}
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">1. Select Token</div>
          <div className="flex gap-2">
            {(['USDC', 'EURC'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold transition ${
                  token === t
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                    : 'border-gray-700 bg-gray-800/40 text-gray-500 hover:text-gray-300'
                }`}
              >
                <TokenLogo token={t} size={16} />{t}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Network */}
        <div className="mb-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">2. Select Network</div>
          <div className="relative">
            <select
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-4 pr-9 text-sm text-white outline-none focus:border-brand-500/50"
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>{c.label} — {c.network}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>

          {/* Critical warning */}
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-700/40 bg-amber-900/20 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300 leading-relaxed">
              In your exchange or wallet, select <span className="font-bold text-amber-200">{selectedChain.network}</span> as the network. Sending on any other network will result in permanent fund loss.
            </p>
          </div>
        </div>

        {/* Step 3 — Address */}
        <div className="mb-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">3. Send to This Address</div>
          <div className="mb-3 flex justify-center">
            <div className="rounded-xl border border-gray-700/60 bg-white p-3">
              {address ? (
                <QRCodeSVG value={address} size={150} bgColor="#ffffff" fgColor="#0a0f1e" level="M" />
              ) : (
                <div className="h-[150px] w-[150px] animate-pulse rounded-xl bg-gray-200" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2.5">
            <span className="flex flex-1 items-center gap-2 min-w-0">
              <ChainLogo chain={selectedChain.id} size={14} />
              <span className="truncate font-mono text-xs text-gray-200">{address ?? 'Loading…'}</span>
            </span>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-700 hover:text-brand-400 transition"
            >
              {copied ? <CheckCheck className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Username section */}
        {username && (
          <div className="border-t border-gray-800 pt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <AtSign className="h-3 w-3" />
              Receive from Architect Pay Users
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-2.5">
              <span className="flex-1 font-mono text-sm font-semibold text-brand-400">@{username}</span>
              <button
                onClick={copyUsername}
                className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-700 hover:text-brand-400 transition"
              >
                {copiedUsername ? <CheckCheck className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
