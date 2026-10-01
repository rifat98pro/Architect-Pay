'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [tab, setTab]           = useState<'google' | 'email'>('google')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleGoogle() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #060e28 0%, #0b1e47 50%, #0b2c2c 100%)' }}>
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl p-8"
          style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.2)', boxShadow: '0 0 40px rgba(42,171,171,0.08)' }}
        >
          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-brand-500/20 to-navy-800/20 blur-md" />
              <Image src="/logo.png" alt="Architect Pay" width={64} height={64} className="relative rounded-2xl object-contain" />
            </div>
            <span className="text-xl font-bold">
              <span style={{ color: '#ffffff' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold text-white">Welcome back</h1>
          <p className="mb-6 text-center text-sm text-gray-400">Sign in to manage your USDC payroll</p>

          {/* Tabs */}
          <div className="mb-6 flex rounded-xl bg-gray-800/50 p-1">
            <button
              onClick={() => { setTab('google'); setError('') }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === 'google' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Google
            </button>
            <button
              onClick={() => { setTab('email'); setError('') }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === 'email' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Email
            </button>
          </div>

          {tab === 'google' ? (
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-lg transition hover:bg-gray-100 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>
          ) : (
            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                  <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-400 hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
