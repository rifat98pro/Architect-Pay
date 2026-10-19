'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { Loader2, Check, Camera, Trash2, KeyRound } from 'lucide-react'

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload  = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refresh: refreshSession } = useAuth()
  const { theme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)

  const [username,     setUsername]     = useState('')
  const [displayName,  setDisplayName]  = useState('')
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [avatarPreview,setAvatarPreview]= useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)

  // An account made through Google has no password yet, so the form asks to set
  // one rather than to confirm an old one that does not exist.
  const [hasPassword,  setHasPassword]  = useState<boolean | null>(null)
  const [currentPw,    setCurrentPw]    = useState('')
  const [newPw,        setNewPw]        = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [pwSaving,     setPwSaving]     = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwDone,       setPwDone]       = useState('')

  useEffect(() => {
    fetch('/api/account/password')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setHasPassword(!!d.hasPassword) })
      .catch(() => {})
  }, [])

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(''); setPwDone('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 8)    { setPwError('At least 8 characters');  return }

    setPwSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword: currentPw || undefined, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not update password')
      setHasPassword(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwDone('Password saved. You can now sign in with your username or email.')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setPwSaving(false)
    }
  }
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [avatarError,  setAvatarError]  = useState('')

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
        setAvatarUrl(d.user?.image ?? null)
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return }

    if (file.size > 1_500_000) { setAvatarError('Image too large (max 1.5 MB).'); return }

    setAvatarError('')
    setAvatarSaving(true)
    try {
      const base64 = await readFileAsBase64(file)
      setAvatarPreview(base64)

      const res  = await fetch('/api/account/avatar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAvatarUrl(data.image)
      setAvatarPreview(null)
    } catch (err) {
      setAvatarPreview(null)
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarSaving(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarSaving(true)
    try {
      await fetch('/api/account/avatar', { method: 'DELETE' })
      setAvatarUrl(null)
      setAvatarPreview(null)
    } finally {
      setAvatarSaving(false)
    }
  }

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
      refreshSession() // background sync — no need to await
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const displayImg = avatarPreview ?? avatarUrl
  const initials   = (displayName || user?.email || '?')[0].toUpperCase()

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-2xl font-bold" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>Account Settings</h1>
      <p className="mb-6 text-sm" style={{ color: theme === 'light' ? '#637d96' : '#8faab8' }}>
        Manage your profile and Architect Pay username.
      </p>

      {/* Profile picture section */}
      <div className="mb-5 rounded-2xl border p-5" style={{ background: theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)', borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)' }}>
        <h2 className="mb-4 text-sm font-semibold" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>Profile Photo</h2>
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-gray-700 bg-gray-800">
              {displayImg ? (
                <img src={displayImg} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-400">
                  {initials}
                </div>
              )}
            </div>
            {avatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex-1">
            <p className="mb-3 text-xs text-gray-500">JPG, PNG or GIF · Max 1.5 MB · Original quality</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarSaving}
                className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarSaving}
                  className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/40 transition disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
            {avatarError && <p className="mt-2 text-xs text-red-400">{avatarError}</p>}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Profile info form */}
      <div className="rounded-2xl border p-5" style={{ background: theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)', borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)' }}>
        <h2 className="mb-4 text-sm font-semibold" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>Profile Info</h2>

        {error   && <div className="mb-4 rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-900/30 px-4 py-3 text-sm text-green-400"><Check className="h-4 w-4" />{success}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-base"
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>
              Username
              <span className="ml-2 text-xs font-normal" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>lowercase letters, numbers, underscores only</span>
            </label>
            <div
              className="flex items-center overflow-hidden rounded-lg border"
              style={{
                background:   theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
                borderColor:  theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <span
                className="flex h-full items-center px-3 py-2.5 text-sm border-r"
                style={{
                  background:  theme === 'light' ? '#f0f4f8' : 'rgba(18,32,49,0.8)',
                  borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
                  color:       theme === 'light' ? '#637d96' : '#45607a',
                }}
              >@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="flex-1 bg-transparent px-3 py-2.5 font-mono outline-none"
                style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}
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

          <div className="rounded-xl px-4 py-3" style={{ background: theme === 'light' ? '#f0f4f8' : 'rgba(18,32,49,0.5)' }}>
            <div className="text-xs font-medium mb-0.5" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>Account email</div>
            <div className="font-mono text-sm" style={{ color: theme === 'light' ? '#324862' : '#c5d3ed' }}>{user?.email}</div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Password — every account can sign in both ways. Google works regardless;
          setting a password here adds username/email sign-in on top of it. */}
      <div
        className="mt-6 rounded-2xl border p-6"
        style={{
          background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
          borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-400" />
          <h2 className="text-base font-semibold" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>
            {hasPassword ? 'Change password' : 'Set a password'}
          </h2>
        </div>
        <p className="mb-4 text-xs" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>
          {hasPassword
            ? 'Sign in with your username or email, or keep using Google — both work.'
            : 'Your account was created with Google. Set a password to also sign in with your username or email.'}
        </p>

        <form onSubmit={savePassword} className="space-y-3">
          {hasPassword && (
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{
                background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
                borderColor: theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)',
                color:       theme === 'light' ? '#0b1e47' : '#ffffff',
              }}
            />
          )}
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder={hasPassword ? 'New password' : 'Password'}
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{
              background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
              borderColor: theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)',
              color:       theme === 'light' ? '#0b1e47' : '#ffffff',
            }}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{
              background:  theme === 'light' ? '#ffffff' : 'rgba(18,32,49,0.6)',
              borderColor: theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)',
              color:       theme === 'light' ? '#0b1e47' : '#ffffff',
            }}
          />

          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          {pwDone  && <p className="text-xs text-green-400">{pwDone}</p>}

          <button
            type="submit"
            disabled={pwSaving || !newPw || !confirmPw}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {pwSaving ? 'Saving...' : hasPassword ? 'Update password' : 'Set password'}
          </button>
        </form>
      </div>
    </div>
  )
}
