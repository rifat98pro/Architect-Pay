'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { Building2, Plus, Pencil, Trash2, Loader2, Check, X, ChevronRight, Users, Camera } from 'lucide-react'

interface Business { id: string; name: string; logoUrl?: string | null; createdAt: string; _count?: { employees: number } }

export default function BusinessesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { theme } = useTheme()
  const L = theme === 'light'
  const t1 = L ? '#0b1e47' : '#ffffff'
  const t2 = L ? '#45607a' : '#8faab8'
  const t3 = L ? '#637d96' : '#45607a'
  const card = { background: L ? '#ffffff' : 'rgba(18,32,49,0.6)', border: `1px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}` }
  const divider = L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
  const inputStyle = { background: L ? '#ffffff' : 'rgba(18,32,49,0.6)', border: `1px solid ${L ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'}`, color: t1 }

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [error,      setError]      = useState('')

  const [renamingId,   setRenamingId]   = useState<string | null>(null)
  const [renameValue,  setRenameValue]  = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/businesses')
      .then((r) => r.json())
      .then((d) => setBusinesses(d.businesses ?? []))
      .finally(() => setLoading(false))
  }, [user?.id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    setAdding(true)
    try {
      const res  = await fetch('/api/businesses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error('A business with this name may already exist.')
      setBusinesses((prev) => [...prev, data.business])
      setNewName('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    setBusinesses((prev) => prev.filter((b) => b.id !== id))
  }

  function startRename(biz: Business) {
    setRenamingId(biz.id)
    setRenameValue(biz.name)
  }

  async function saveRename(id: string) {
    if (!renameValue.trim()) return
    setRenameSaving(true)
    try {
      const res  = await fetch(`/api/businesses/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setBusinesses((prev) => prev.map((b) => b.id === id ? { ...b, name: data.business.name } : b))
        setRenamingId(null)
      }
    } finally {
      setRenameSaving(false)
    }
  }

  function triggerLogoUpload(id: string) {
    uploadTargetId.current = id
    logoInputRef.current?.click()
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const id   = uploadTargetId.current
    if (!file || !id) return
    e.target.value = ''

    setUploadingId(id)
    try {
      const form = new FormData()
      form.append('logo', file)
      const res  = await fetch(`/api/businesses/${id}/logo`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setBusinesses((prev) => prev.map((b) => b.id === id ? { ...b, logoUrl: data.business.logoUrl } : b))
      }
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Hidden file input for logo uploads */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: t1 }}>Businesses</h1>
          <p className="mt-1 text-sm" style={{ color: t2 }}>Manage your organizations and their payroll.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition"
        >
          <Plus className="h-4 w-4" /> New Business
        </button>
      </div>

      {/* New business form */}
      {showForm && (
        <div className="mb-6 rounded-2xl p-5" style={card}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: t1 }}>New Business</h2>
          {error && <div className="mb-3 rounded-xl bg-red-900/30 px-4 py-2.5 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Business name (e.g. Acme Corp)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-base flex-1"
              style={inputStyle}
              maxLength={100}
              required
            />
            <button type="submit" disabled={adding} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 whitespace-nowrap">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {adding ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="rounded-xl px-4 py-2.5 text-sm transition" style={{ border: `1px solid ${divider}`, color: t2 }}>
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center" style={{ borderColor: L ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)' }}>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: L ? '#f0f4f8' : 'rgba(255,255,255,0.05)' }}>
            <Building2 className="h-7 w-7" style={{ color: t3 }} />
          </div>
          <p className="mb-1 text-sm font-medium" style={{ color: t1 }}>No businesses yet</p>
          <p className="mb-5 text-xs" style={{ color: t3 }}>Create your first business to start managing payroll.</p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition">
            <Plus className="h-4 w-4" /> New Business
          </button>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={card}>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide" style={{ borderBottom: `1px solid ${divider}`, background: L ? '#f5f8fb' : 'rgba(18,32,49,0.6)', color: t3 }}>
            <span>Business</span>
            <span className="w-28 text-center">Employees</span>
            <span className="w-32">Created</span>
            <span className="w-24" />
          </div>

          <div style={{ background: L ? '#ffffff' : 'rgba(12,24,38,0.3)' }}>
            {businesses.map((biz) => (
              <div key={biz.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 transition" style={{ borderTop: `1px solid ${divider}` }}>
                {/* Name + logo */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Logo avatar with upload on hover */}
                  <button
                    type="button"
                    onClick={() => triggerLogoUpload(biz.id)}
                    className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden transition"
                    style={{ background: biz.logoUrl ? 'transparent' : 'rgba(42,171,171,0.15)' }}
                    title="Change photo"
                  >
                    {uploadingId === biz.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                    ) : biz.logoUrl ? (
                      <>
                        <img src={biz.logoUrl} alt={biz.name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
                          <Camera className="h-3.5 w-3.5 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-brand-400">{biz.name[0].toUpperCase()}</span>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl">
                          <Camera className="h-3.5 w-3.5 text-white" />
                        </div>
                      </>
                    )}
                  </button>

                  {renamingId === biz.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveRename(biz.id); if (e.key === 'Escape') setRenamingId(null) }}
                        className="input-base py-1 text-sm flex-1"
                        style={inputStyle}
                        maxLength={100}
                      />
                      <button onClick={() => saveRename(biz.id)} disabled={renameSaving} className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-500/10 transition">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="rounded-lg p-1.5 transition" style={{ color: t3 }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="truncate font-medium" style={{ color: t1 }}>{biz.name}</div>
                    </div>
                  )}
                </div>

                {/* Employee count */}
                <div className="w-28 flex items-center justify-center gap-1.5 text-sm" style={{ color: t2 }}>
                  <Users className="h-3.5 w-3.5" style={{ color: t3 }} />
                  <span>{biz._count?.employees ?? '—'}</span>
                </div>

                {/* Date */}
                <div className="w-32 text-sm" style={{ color: t3 }}>
                  {new Date(biz.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Actions */}
                <div className="w-24 flex items-center justify-end gap-1">
                  {renamingId !== biz.id && (
                    <button onClick={() => startRename(biz)} className="rounded-lg p-1.5 transition" style={{ color: t3 }} title="Rename">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(biz.id)} className="rounded-lg p-1.5 hover:bg-red-900/20 hover:text-red-400 transition" style={{ color: t3 }} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => router.push(`/businesses/${biz.id}`)}
                    className="ml-1 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/10 transition"
                  >
                    Manage <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-3" style={{ borderTop: `1px solid ${divider}`, background: L ? '#f5f8fb' : 'rgba(18,32,49,0.6)' }}>
            <span className="text-xs" style={{ color: t3 }}>{businesses.length} business{businesses.length !== 1 ? 'es' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
