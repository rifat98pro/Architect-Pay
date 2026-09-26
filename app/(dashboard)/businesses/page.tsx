'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Building2, Plus, Pencil, Trash2, Loader2, Check, X, ChevronRight } from 'lucide-react'

interface Business { id: string; name: string; createdAt: string }

export default function BusinessesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [error,      setError]      = useState('')

  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving,setRenameSaving]= useState(false)

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
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-white">Businesses</h1>
      <p className="mb-6 text-sm text-gray-400">
        Create and manage your businesses. Each business has its own employee roster and payroll.
      </p>

      {/* Create new business */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Create Business</h2>
        {error && (
          <div className="mb-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</div>
        )}
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            placeholder="Business name (e.g. Acme Corp, Studio X)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-base flex-1"
            maxLength={100}
            required
          />
          <button type="submit" disabled={adding} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {adding ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Business list */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : businesses.length === 0 ? (
        <div className="card py-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">No businesses yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-gray-800 px-5 py-3">
            <span className="text-sm font-medium text-gray-400">{businesses.length} business{businesses.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="divide-y divide-gray-800">
            {businesses.map((biz) => (
              <div key={biz.id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                  <Building2 className="h-4 w-4 text-brand-500" />
                </div>

                {renamingId === biz.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(biz.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="input-base flex-1 py-1.5 text-sm"
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
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">{biz.name}</div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(biz.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => startRename(biz)}
                      className="rounded-lg p-1.5 text-gray-600 hover:bg-brand-500/10 hover:text-brand-400 transition"
                      title="Rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(biz.id)}
                      className="rounded-lg p-1.5 text-gray-600 hover:bg-red-900/20 hover:text-red-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/businesses/${biz.id}`)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-400 transition hover:bg-brand-500/10"
                    >
                      Manage
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
