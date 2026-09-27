'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { UserPlus, Trash2, Loader2, Pencil, Check, X, Copy, CheckCheck, ArrowLeft, AtSign, Wallet, CheckCircle2, XCircle } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Employee {
  id:            string
  name:          string
  walletAddress: string
  salary:        string
  role:          string | null
}
interface EditState { name: string; walletAddress: string; salary: string; role: string }
interface Business  { id: string; name: string }

export default function BusinessEmployeesPage() {
  const router  = useRouter()
  const params  = useParams<{ id: string }>()
  const bizId   = params.id
  const { user, loading: authLoading } = useAuth()

  const [business,   setBusiness]   = useState<Business | null>(null)
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [salary,  setSalary]  = useState('')
  const [role,    setRole]    = useState('')

  type WalletMode = 'address' | 'username'
  type LookupState = 'idle' | 'loading' | 'found' | 'notfound'
  const [walletMode,       setWalletMode]       = useState<WalletMode>('address')
  const [usernameInput,    setUsernameInput]    = useState('')
  const [lookupState,      setLookupState]      = useState<LookupState>('idle')
  const [resolvedAddress,  setResolvedAddress]  = useState('')
  const [resolvedName,     setResolvedName]     = useState('')

  const [copiedId,      setCopiedId]      = useState<string | null>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editState,     setEditState]     = useState<EditState | null>(null)
  const [editSaving,    setEditSaving]    = useState(false)
  const [editError,     setEditError]     = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id || !bizId) return
    Promise.all([
      fetch('/api/businesses').then((r) => r.json()),
      fetch(`/api/employees?businessId=${bizId}`).then((r) => r.json()),
    ]).then(([bizData, empData]) => {
      const found = (bizData.businesses ?? []).find((b: Business) => b.id === bizId)
      if (!found) { router.push('/businesses'); return }
      setBusiness(found)
      setEmployees(empData.employees ?? [])
    }).finally(() => setLoading(false))
  }, [user?.id, bizId])

  // Live username lookup for add form
  useEffect(() => {
    const raw = usernameInput.trim().replace(/^@/, '')
    if (walletMode !== 'username' || !raw || raw.length < 3) {
      setLookupState('idle'); setResolvedAddress(''); setResolvedName(''); return
    }
    setLookupState('loading')
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/users/lookup?username=${encodeURIComponent(raw)}`)
        const data = await res.json()
        if (res.ok && data.found) {
          setLookupState('found'); setResolvedAddress(data.walletAddress); setResolvedName(data.displayName)
        } else {
          setLookupState('notfound'); setResolvedAddress(''); setResolvedName('')
        }
      } catch { setLookupState('notfound') }
    }, 500)
    return () => clearTimeout(t)
  }, [usernameInput, walletMode])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const finalAddress = walletMode === 'username' ? resolvedAddress : address
    try {
      const res = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, walletAddress: finalAddress, salary, role: role || undefined, businessId: bizId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => [...prev, data.employee])
      setName(''); setAddress(''); setUsernameInput(''); setSalary(''); setRole('')
      setResolvedAddress(''); setResolvedName(''); setLookupState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  function copyAddress(id: string, addr: string) {
    navigator.clipboard.writeText(addr)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditError('')
    setEditState({ name: emp.name, walletAddress: emp.walletAddress, salary: emp.salary, role: emp.role ?? '' })
  }

  function cancelEdit() { setEditingId(null); setEditState(null); setEditError('') }

  async function saveEdit(id: string) {
    if (!editState) return
    setEditError('')
    setEditSaving(true)
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...editState, role: editState.role || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => prev.map((e) => e.id === id ? data.employee : e))
      setEditingId(null); setEditState(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  const totalSalary = employees.reduce((s, e) => s + parseFloat(e.salary), 0).toFixed(2)

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/businesses')}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-400 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Businesses
      </button>

      <h1 className="mb-1 text-2xl font-bold text-white">{business?.name}</h1>
      <p className="mb-6 text-sm text-gray-400">Manage employees and salaries for this business.</p>

      {/* Add Employee */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Add Employee</h2>
        {error && <div className="mb-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</div>}
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="input-base" required maxLength={100} />
          <input type="text" placeholder="Employee role (e.g. Engineer)" value={role} onChange={(e) => setRole(e.target.value)} className="input-base" maxLength={100} />
          <div className="sm:col-span-2">
            <div
              className="mb-2 flex gap-1 rounded-xl p-1"
              style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.12)' }}
            >
              <button type="button" onClick={() => setWalletMode('address')}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                  walletMode === 'address' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300')}>
                <Wallet className="h-3 w-3" /> Wallet Address
              </button>
              <button type="button" onClick={() => setWalletMode('username')}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                  walletMode === 'username' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300')}>
                <AtSign className="h-3 w-3" /> Architect Pay Username
              </button>
            </div>
            {walletMode === 'address' ? (
              <input type="text" placeholder="Wallet address (0x...)" value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-base font-mono text-xs" pattern="^0x[a-fA-F0-9]{40}$" title="Valid EVM address" required />
            ) : (
              <div>
                <div className="flex items-center input-base overflow-hidden p-0">
                  <span className="flex h-full items-center px-3 text-sm text-gray-500 border-r border-gray-700 bg-gray-800/50">@</span>
                  <input type="text" placeholder="username" value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600"
                    autoComplete="off" required />
                </div>
                {lookupState === 'loading' && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking up...
                  </div>
                )}
                {lookupState === 'found' && (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-green-900/20 px-3 py-1.5 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                    <span className="font-medium text-green-300">{resolvedName}</span>
                    <span className="text-gray-500 font-mono">{resolvedAddress.slice(0,8)}…{resolvedAddress.slice(-6)}</span>
                  </div>
                )}
                {lookupState === 'notfound' && usernameInput.length >= 3 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                    <XCircle className="h-3 w-3 shrink-0" /> User not found.
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <input type="number" step="0.01" min="0.01" placeholder="Salary (USDC)" value={salary} onChange={(e) => setSalary(e.target.value)} className="input-base pr-8" required />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
          </div>
          <button type="submit"
            disabled={saving || (walletMode === 'username' && lookupState !== 'found')}
            className="btn-primary sm:col-span-2 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? 'Adding...' : 'Add Employee'}
          </button>
        </form>
      </div>

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="card py-12 text-center text-sm text-gray-500">No employees yet. Add your first employee above.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <span className="text-sm font-medium text-gray-400">{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-semibold text-white">Total: ${totalSalary} USDC/run</span>
          </div>
          <div className="divide-y divide-gray-800">
            {employees.map((emp) =>
              editingId === emp.id && editState ? (
                <div key={emp.id} className="px-5 py-4 space-y-3" style={{ background: 'rgba(42,171,171,0.04)' }}>
                  {editError && <div className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{editError}</div>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input type="text" value={editState.name} onChange={(e) => setEditState({ ...editState, name: e.target.value })} placeholder="Full name" className="input-base text-sm" maxLength={100} />
                    <input type="text" value={editState.role} onChange={(e) => setEditState({ ...editState, role: e.target.value })} placeholder="Role" className="input-base text-sm" maxLength={100} />
                    <input type="text" value={editState.walletAddress} onChange={(e) => setEditState({ ...editState, walletAddress: e.target.value })} placeholder="Wallet address" className="input-base font-mono text-xs" />
                    <div className="relative">
                      <input type="number" step="0.01" min="0.01" value={editState.salary} onChange={(e) => setEditState({ ...editState, salary: e.target.value })} className="input-base pr-8 text-sm" />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(emp.id)} disabled={editSaving} className="btn-primary flex items-center gap-1.5 py-1.5 text-xs">
                      {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                    </button>
                    <button onClick={cancelEdit} className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-500">
                    {emp.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">{emp.name}</div>
                    {emp.role && <div className="text-xs font-medium text-brand-400">{emp.role}</div>}
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-500">{truncateAddress(emp.walletAddress, 8)}</span>
                      <button onClick={() => copyAddress(emp.id, emp.walletAddress)} className="rounded p-0.5 text-gray-600 hover:text-brand-400 transition" title="Copy address">
                        {copiedId === emp.id ? <CheckCheck className="h-3 w-3 text-brand-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">${parseFloat(emp.salary).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">per run</div>
                  </div>
                  <button onClick={() => startEdit(emp)} className="ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-brand-500/10 hover:text-brand-400 transition">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(emp.id)} className="rounded-lg p-1.5 text-gray-600 hover:bg-red-900/20 hover:text-red-400 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
