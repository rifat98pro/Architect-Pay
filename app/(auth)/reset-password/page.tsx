'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

const cardStyle = {
  background: '#0d1926',
  border:     '1px solid rgba(42,171,171,0.2)',
  boxShadow:  '0 0 40px rgba(42,171,171,0.08)',
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') ?? ''
  const email        = searchParams.get('email') ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!token || !email) setError('Invalid reset link. Please request a new one.')
  }, [token, email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
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

          {done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Password updated!</h1>
                <p className="mt-2 text-sm text-gray-400">Redirecting you to sign in…</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-center text-2xl font-bold text-white">Set new password</h1>
              <p className="mb-6 text-center text-sm text-gray-400">Choose a strong password for your account.</p>

              {error && !token ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                  <Link href="/forgot-password" className="text-sm text-brand-400 hover:underline">Request a new link</Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">New Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Min. 8 characters"
                        className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                      />
                      <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">Confirm Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Repeat your password"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60">
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
