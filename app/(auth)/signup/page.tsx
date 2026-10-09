'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Loader2, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'

const cardStyle = {
  background: '#0d1926',
  border:     '1px solid rgba(42,171,171,0.2)',
  boxShadow:  '0 0 40px rgba(42,171,171,0.08)',
}

const inputClass =
  'w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30'

export default function SignupPage() {
  const [step, setStep]         = useState<'details' | 'verify'>('details')

  // step 1 fields
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)

  // step 2 fields
  const [code, setCode]         = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startCountdown() {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return }
      setStep('verify')
      startCountdown()
    } finally { setLoading(false) }
  }

  async function handleResend() {
    if (countdown > 0) return
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to resend code'); return }
      startCountdown()
    } finally { setLoading(false) }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, username, email, password, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Verification failed'); return }
      await signIn('credentials', { identifier: email, password, callbackUrl: '/onboarding' })
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/onboarding' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(135deg, #060e28 0%, #0b1e47 50%, #0b2c2c 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl p-8" style={cardStyle}>

          {/* Logo */}
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

          {step === 'details' ? (
            <>
              <h1 className="mb-1 text-center text-2xl font-bold text-white">Create account</h1>
              <p className="mb-6 text-center text-sm text-gray-400">Your Circle wallet is provisioned on first sign-in</p>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Satoshi Nakamoto" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    placeholder="satoshi"
                    minLength={3}
                    maxLength={20}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-600">3–20 chars, letters/numbers/underscores</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      className={`${inputClass} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Sending code…' : 'Continue'}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-600">or</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              <button onClick={handleGoogle} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-lg transition hover:bg-gray-100 disabled:opacity-60">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <p className="mt-5 text-center text-xs text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-brand-400 hover:underline">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2">
                <button onClick={() => { setStep('details'); setError(''); setCode('') }} className="text-gray-500 hover:text-gray-300 transition">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-white">Check your email</h1>
              </div>

              <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-gray-700/60 bg-gray-800/30 p-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                  <Mail className="h-5 w-5 text-brand-400" />
                </div>
                <p className="text-sm text-gray-300">
                  We sent a 6-digit code to<br />
                  <span className="font-medium text-white">{email}</span>
                </p>
                <p className="text-xs text-gray-500">Valid for 10 minutes</p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    maxLength={6}
                    className={`${inputClass} tracking-widest text-center text-lg font-mono`}
                    autoFocus
                  />
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button type="submit" disabled={loading || code.length < 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Verifying…' : 'Create Account'}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-gray-500">
                Didn&apos;t receive it?{' '}
                {countdown > 0 ? (
                  <span className="text-gray-600">Resend in {countdown}s</span>
                ) : (
                  <button onClick={handleResend} disabled={loading} className="text-brand-400 hover:underline disabled:opacity-50">
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
