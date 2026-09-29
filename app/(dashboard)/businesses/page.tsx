'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Building2, Plus, Pencil, Trash2, Loader2, Check, X, ChevronRight, Users } from 'lucide-react'

interface Business { id: string; name: string; createdAt: string; _count?: { employees: number } }

export default function BusinessesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [error,      setError]      = useState('')

  const [renamingId,   setRenamingId]   = useState<string | null>(null)
  const [renameValue,  setRenameValue]  = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

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

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Businesses</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your organizations and their payroll.</p>
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
        <div className="mb-6 rounded-2xl border border-gray-700/60 bg-gray-900/80 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">New Business</h2>
          {error && <div className="mb-3 rounded-xl bg-red-900/30 px-4 py-2.5 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Business name (e.g. Acme Corp)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-base flex-1"
              maxLength={100}
              required
            />
            <button type="submit" disabled={adding} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 whitespace-nowrap">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {adding ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 transition">
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
            <Building2 className="h-7 w-7 text-gray-600" />
          </div>
          <p className="mb-1 text-sm font-medium text-gray-300">No businesses yet</p>
          <p className="mb-5 text-xs text-gray-600">Create your first business to start managing payroll.</p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition">
            <Plus className="h-4 w-4" /> New Business
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-700/60 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-gray-700/60 bg-gray-900/60 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Business</span>
            <span className="w-28 text-center">Employees</span>
            <span className="w-32">Created</span>
            <span className="w-24" />
          </div>

          <div className="divide-y divide-gray-800/60 bg-gray-900/40">
            {businesses.map((biz) => (
              <div key={biz.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition">
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-sm font-bold text-brand-400">
                    {biz.name[0].toUpperCase()}
                  </div>
                  {renamingId === biz.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveRename(biz.id); if (e.key === 'Escape') setRenamingId(null) }}
                        className="input-base py-1 text-sm flex-1"
                        maxLength={100}
                      />
                      <button onClick={() => saveRename(biz.id)} disabled={renameSaving} className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-500/10 transition">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 transition">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">{biz.name}</div>
                    </div>
                  )}
                </div>

                {/* Employee count */}
                <div className="w-28 flex items-center justify-center gap-1.5 text-sm text-gray-400">
                  <Users className="h-3.5 w-3.5 text-gray-600" />
                  <span>{(biz as Business & { _count?: { employees: number } })._count?.employees ?? '—'}</span>
                </div>

                {/* Date */}
                <div className="w-32 text-sm text-gray-500">
                  {new Date(biz.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Actions */}
                <div className="w-24 flex items-center justify-end gap-1">
                  {renamingId !== biz.id && (
                    <button onClick={() => startRename(biz)} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-700 hover:text-gray-300 transition" title="Rename">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(biz.id)} className="rounded-lg p-1.5 text-gray-600 hover:bg-red-900/20 hover:text-red-400 transition" title="Delete">
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

          <div className="border-t border-gray-800/60 bg-gray-900/60 px-6 py-3">
            <span className="text-xs text-gray-600">{businesses.length} business{businesses.length !== 1 ? 'es' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
