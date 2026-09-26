'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #060e28 0%, #0b1e47 50%, #0b2c2c 100%)' }}>
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl p-8 text-center"
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

          <h1 className="mb-1 text-2xl font-bold text-white">Welcome back</h1>
          <p className="mb-8 text-sm text-gray-400">Sign in to manage your USDC payroll</p>

          {/* Google sign-in button */}
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

          <p className="mt-6 text-xs text-gray-600">
            By signing in you agree to our terms of service.
            <br />Your Circle wallet is provisioned automatically on first sign-in.
          </p>
        </div>
      </div>
    </div>
  )
}
