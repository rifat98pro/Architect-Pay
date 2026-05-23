'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export default function SignupPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string'
          ? data.error
          : Object.values(data.error as Record<string, string[]>).flat()[0]
        throw new Error(msg)
      }

      await refresh()
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Image src="/logo.png" alt="Architect Pay" width={52} height={52} className="rounded-xl object-contain" />
            <span className="text-lg font-bold text-brand-600">Architect Pay</span>
          </div>
          <h1 className="mb-1 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mb-6 text-sm text-gray-500">
            An Arc Testnet wallet is created automatically when you sign up.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-base"
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
                placeholder="jane@company.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creating account & wallet...' : 'Create account & wallet'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
