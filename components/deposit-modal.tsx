'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const CHAINS = [
  { id: 'ETH-SEPOLIA',  label: 'Ethereum Sepolia' },
  { id: 'BASE-SEPOLIA', label: 'Base Sepolia'      },
  { id: 'ARB-SEPOLIA',  label: 'Arbitrum Sepolia'  },
  { id: 'MATIC-AMOY',   label: 'Polygon Amoy'      },
]

export default function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const [chain,   setChain]   = useState('ETH-SEPOLIA')
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/wallet/deposit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sourceChain: chain, amount }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? 'Deposit failed')
      }

      setDone(true)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deposit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Deposit USDC to Arc</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="mb-2 text-3xl">✅</div>
            <p className="font-semibold text-gray-900">Deposit complete!</p>
            <p className="mt-1 text-sm text-gray-500">
              USDC has been minted to your Arc Testnet wallet via CCTP.
            </p>
            <button onClick={onClose} className="btn-primary mx-auto mt-4">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeposit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Source chain
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="input-base"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Amount (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base"
                placeholder="10.00"
                required
              />
            </div>

            <p className="text-xs text-gray-400">
              USDC burns on {CHAINS.find((c) => c.id === chain)?.label} and mints directly into your Arc Testnet wallet via CCTP (~2–3 minutes). A small relayer fee (~1%) applies.
            </p>

            {loading && (
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Transferring via CCTP (~2–3 min): approving → burning → attesting → minting on Arc. Do not close this window.</span>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Deposit {amount ? `$${amount} USDC` : 'USDC'} to Arc
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
