'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Loader2, Check, AtSign, User } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/account/settings')
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? '')
        setDisplayName(d.user?.displayName ?? d.user?.name ?? '')
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const res  = await fetch('/api/account/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          username:    username.trim() || undefined,
          displayName: displayName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        throw new Error(msg)
      }
      setUsername(data.user.username ?? '')
      setDisplayName(data.user.displayName ?? '')
      setSuccess('Settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-2xl font-bold text-white">Account Settings</h1>
      <p className="mb-6 text-sm text-gray-400">
        Set your Architect Pay username so others can send you payments directly.
      </p>

      <div className="card">
        {error   && <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-400 flex items-center gap-2"><Check className="h-4 w-4" />{success}</div>}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Display name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-base pl-9"
                placeholder="Your name"
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Username
              <span className="ml-2 text-xs font-normal text-gray-500">lowercase letters, numbers, underscores only</span>
            </label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="input-base pl-9 font-mono"
                placeholder="yourname"
                minLength={3}
                maxLength={30}
              />
            </div>
            {username && (
              <p className="mt-1.5 text-xs text-gray-500">
                Others can pay you as <span className="text-brand-400">@{username}</span>
              </p>
            )}
          </div>

          <div className="rounded-lg bg-gray-800/50 px-4 py-3 text-sm text-gray-400">
            <div className="font-medium text-gray-300 mb-1">Account email</div>
            <div className="font-mono text-xs">{user?.email}</div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
