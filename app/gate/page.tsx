'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function GatePage() {
  const router   = useRouter()
  const [pw, setPw]       = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/gate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pw }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#000' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Architect Pay" width={48} height={48} className="rounded-2xl object-contain" />
          <div className="text-lg font-bold tracking-tight">
            <span style={{ color: '#c5d3ed' }}>Architect</span>
            <span style={{ color: '#2aabab' }}> Pay</span>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: 'rgba(42,171,171,0.3)', background: 'rgba(42,171,171,0.06)', color: '#2aabab' }}>
            Private Beta — Team Access Only
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="rounded-2xl border p-6"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <h1 className="mb-1 text-lg font-bold text-white">Enter password</h1>
          <p className="mb-5 text-sm" style={{ color: '#555' }}>This app is in private testing. Enter the team password to continue.</p>

          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mb-3 w-full rounded-xl border bg-transparent px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-brand-500"
            style={{ borderColor: error ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.1)' }}
          />

          {error && (
            <p className="mb-3 text-xs text-red-400">Wrong password. Try again.</p>
          )}

          <button
            type="submit"
            disabled={!pw || loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-black transition disabled:opacity-40"
            style={{ background: '#2aabab' }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
