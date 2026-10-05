'use client'

import { useEffect, useState } from 'react'
import { X, Copy, CheckCheck, Info, AtSign } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

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

  useEffect(() => {
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((d) => { if (d.address) setAddress(d.address) })
    fetch('/api/account/settings')
      .then((r) => r.json())
      .then((d) => { if (d.user?.username) setUsername(d.user.username) })
  }, [])

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
            <h2 className="text-lg font-bold" style={{ color: '#ffffff' }}>Deposit</h2>
            <p className="text-xs" style={{ color: '#8faab8' }}>Send tokens to your wallet address</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="mb-5 flex justify-center">
          <div className="rounded-2xl border border-gray-700/60 bg-white p-3.5">
            {address ? (
              <QRCodeSVG
                value={address}
                size={180}
                bgColor="#ffffff"
                fgColor="#0a0f1e"
                level="M"
              />
            ) : (
              <div className="h-[180px] w-[180px] animate-pulse rounded-xl bg-gray-200" />
            )}
          </div>
        </div>

        {/* Address */}
        <div className="mb-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Your Wallet Address
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-xs text-gray-200">
              {address ?? 'Loading…'}
            </span>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-700 hover:text-brand-400 transition"
            >
              {copied ? <CheckCheck className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-500/15 bg-brand-500/8 px-3 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
          <p className="text-xs text-gray-400 leading-relaxed">
            This address works on <span className="text-white font-medium">Arc Testnet</span>, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Polygon Amoy.
            Send USDC or EURC from any exchange or wallet.
          </p>
        </div>

        {/* Username section */}
        {username && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <AtSign className="h-3 w-3" />
              Add Funds from Architect Pay Account
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2.5">
              <span className="text-xs text-gray-400">Share your username so another Architect Pay user can send you funds directly:</span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-2.5">
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
