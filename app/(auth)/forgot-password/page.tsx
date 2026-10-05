'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

const cardStyle = {
  background: '#0d1926',
  border:     '1px solid rgba(42,171,171,0.2)',
  boxShadow:  '0 0 40px rgba(42,171,171,0.08)',
}

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setSent(true)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #060e28 0%, #0b1e47 50%, #0b2c2c 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl p-8" style={cardStyle}>

          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-brand-500/20 to-navy-800/20 blur-md" />
              <Image src="/logo.png" alt="Architect Pay" width={56} height={56} className="relative rounded-2xl object-contain" />
            </div>
            <span className="text-xl font-bold">
              <span style={{ color: '#ffffff' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(42,171,171,0.12)' }}>
                <CheckCircle2 className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Check your email</h1>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  If <span className="text-white">{email}</span> has an account, a reset link has been sent. Check your inbox and spam folder.
                </p>
              </div>
              <p className="text-xs text-gray-600">The link expires in 1 hour.</p>
              <Link href="/login" className="mt-2 flex items-center gap-1.5 text-sm text-brand-400 hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2">
                <Link href="/login" className="text-gray-500 hover:text-gray-300 transition">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-xl font-bold text-white">Forgot password?</h1>
              </div>
              <p className="mb-6 text-sm text-gray-400">Enter your email and we&apos;ll send you a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
