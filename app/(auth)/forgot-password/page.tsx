'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Loader2, Mail, KeyRound, Eye, EyeOff, CheckCircle2, RefreshCw } from 'lucide-react'

type Step = 'email' | 'verify' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const router                    = useRouter()
  const [step, setStep]           = useState<Step>('email')
  const [email, setEmail]         = useState('')
  const [code, setCode]           = useState('')
  const [newPassword, setNewPw]   = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [resendCd, setResendCd]   = useState(0)
  const [error, setError]         = useState('')
  const codeRef                   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendCd <= 0) return
    const id = setTimeout(() => setResendCd((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCd])

  useEffect(() => {
    if (step === 'verify') setTimeout(() => codeRef.current?.focus(), 100)
  }, [step])

  async function handleSendCode(e: React.FormEvent) {
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
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return }
      setStep('verify')
      setResendCd(60)
    } finally { setLoading(false) }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter the 6-digit code'); return }
    setError('')
    setStep('reset')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPw) { setError('Passwords do not match'); return }
    if (newPassword.length < 8)    { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        // OTP may have been invalid — send them back to verify step
        setError(data.error ?? 'Reset failed')
        if (data.error?.includes('code')) setStep('verify')
        return
      }
      setStep('done')
    } finally { setLoading(false) }
  }

  async function handleResend() {
    setError('')
    setCode('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to resend'); return }
      setResendCd(60)
    } finally { setLoading(false) }
  }

  const cardStyle = {
    background: '#0d1926',
    border:     '1px solid rgba(42,171,171,0.2)',
    boxShadow:  '0 0 40px rgba(42,171,171,0.08)',
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

          {/* ── Step 1: Enter email ── */}
          {step === 'email' && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15">
                  <KeyRound className="h-7 w-7 text-brand-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Forgot password?</h1>
                <p className="mt-1 text-sm text-gray-400">Enter your email and we'll send a reset code</p>
              </div>
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Mail className="h-4 w-4" /> Send Reset Code</>}
                </button>
              </form>
              <p className="mt-5 text-center text-xs text-gray-600">
                Remember it?{' '}
                <Link href="/login" className="text-brand-400 hover:underline">Sign in</Link>
              </p>
            </>
          )}

          {/* ── Step 2: Enter OTP ── */}
          {step === 'verify' && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15">
                  <Mail className="h-7 w-7 text-brand-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Check your email</h1>
                <p className="mt-1 text-sm text-gray-400">
                  We sent a 6-digit code to<br />
                  <span className="font-semibold text-brand-400">{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Verification Code</label>
                  <input
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                  <p className="mt-1.5 text-center text-xs text-gray-600">Code expires in 10 minutes</p>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={code.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" /> Continue
                </button>
              </form>
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  onClick={handleResend}
                  disabled={loading || resendCd > 0}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  <RefreshCw className="h-3 w-3" />
                  {resendCd > 0 ? `Resend in ${resendCd}s` : 'Resend code'}
                </button>
                <button
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  className="text-xs text-gray-600 hover:text-gray-400 transition"
                >
                  ← Change email
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Set new password ── */}
          {step === 'reset' && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15">
                  <KeyRound className="h-7 w-7 text-brand-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Set new password</h1>
                <p className="mt-1 text-sm text-gray-400">Choose a strong password for your account</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPw(e.target.value)}
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
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Re-enter password"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                </div>
                {confirmPw && newPassword !== confirmPw && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || newPassword !== confirmPw || newPassword.length < 8}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</> : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/15">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-white">Password reset!</h1>
              <p className="mb-6 text-sm text-gray-400">Your password has been updated successfully. You can now sign in with your new password.</p>
              <button
                onClick={() => router.push('/login')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
              >
                Go to Sign In
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
