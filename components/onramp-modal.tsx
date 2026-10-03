'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, XCircle } from 'lucide-react'
import { AppKit } from '@circle-fin/app-kit'

const kit = new AppKit()

export default function OnrampModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef    = useRef<ReturnType<typeof kit.onramp.mountIframe> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!containerRef.current) return

    let alive = true

    async function init() {
      try {
        const res     = await fetch('/api/onramp/sessions', { method: 'POST' })
        const session = await res.json()
        if (!res.ok) throw new Error(session.error ?? 'Failed to create session')
        if (!alive || !containerRef.current) return

        widgetRef.current = kit.onramp.mountIframe({
          session,
          container: containerRef.current,
          onInitializationSuccess: () => setLoading(false),
          onInitializationError:   () => { setLoading(false); setError('Widget failed to load. Please try again.') },
          onDepositSettled:        () => { onSuccess(); onClose() },
          onSessionExpired:        () => setError('Session expired. Please close and try again.'),
        })
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Failed to load widget.')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      alive = false
      widgetRef.current?.close()
      widgetRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
          border:     '1px solid rgba(42,171,171,0.18)',
          boxShadow:  '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Deposit Funds</h2>
            <p className="text-xs text-gray-500">Debit card, Apple Pay, or Google Pay</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Widget area */}
        <div className="relative" style={{ minHeight: 560 }}>
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              <XCircle className="h-8 w-8 text-red-400" />
              <p className="text-center text-sm text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition"
              >
                Close
              </button>
            </div>
          )}
          <div ref={containerRef} className="w-full" style={{ minHeight: 560 }} />
        </div>
      </div>
    </div>
  )
}
