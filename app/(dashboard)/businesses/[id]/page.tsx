'use client'

import { useEffect, useRef, useState } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { UserPlus, Trash2, Loader2, Pencil, Check, X, Copy, CheckCheck, ArrowLeft, AtSign, Wallet, CheckCircle2, XCircle, Camera } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-context'
import ChainLogo from '@/components/chain-logo'

const CHAIN_OPTIONS = [
  { value: 'ARC-TESTNET',  label: 'Arc Testnet' },
  { value: 'ETH-SEPOLIA',  label: 'Ethereum' },
  { value: 'BASE-SEPOLIA', label: 'Base' },
  { value: 'ARB-SEPOLIA',  label: 'Arbitrum' },
  { value: 'MATIC-AMOY',   label: 'Polygon' },
]

interface Employee {
  id:             string
  name:           string
  walletAddress:  string
  salary:         string
  role:           string | null
  preferredChain: string
  preferredToken: string
}
interface EditState { name: string; walletAddress: string; salary: string; role: string; preferredChain: string; preferredToken: string }
interface Business  { id: string; name: string; logoUrl?: string | null }

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
  type WalletMode = 'address' | 'username'
  type LookupState = 'idle' | 'loading' | 'found' | 'notfound'

  const [addForm, setAddForm, clearAddForm] = useFeatureState(`biz-${bizId}-add-emp`, {
    showForm: false, name: '', address: '', salary: '', role: '', walletMode: 'address' as WalletMode, usernameInput: '', preferredChain: 'ARC-TESTNET', preferredToken: 'USDC',
  })
  const showForm    = addForm.showForm
  const setShowForm = (v: boolean) => setAddForm({ showForm: v })
  const { name, address, salary, role, walletMode, usernameInput, preferredChain, preferredToken } = addForm
  const setName           = (v: string)     => setAddForm({ name: v })
  const setAddress        = (v: string)     => setAddForm({ address: v })
  const setSalary         = (v: string)     => setAddForm({ salary: v })
  const setRole           = (v: string)     => setAddForm({ role: v })
  const setWalletMode     = (v: WalletMode) => setAddForm({ walletMode: v, usernameInput: '', address: '' })
  const setUsernameInput  = (v: string)     => setAddForm({ usernameInput: v })
  const setPreferredChain = (v: string)     => setAddForm({ preferredChain: v })
  const setPreferredToken = (v: string)     => setAddForm({ preferredToken: v })

  const [lookupState,      setLookupState]      = useState<LookupState>('idle')
  const [resolvedAddress,  setResolvedAddress]  = useState('')
  const [resolvedName,     setResolvedName]     = useState('')

  const [copiedId,      setCopiedId]      = useState<string | null>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editState,     setEditState]     = useState<EditState | null>(null)
  const [editSaving,    setEditSaving]    = useState(false)
  const [editError,     setEditError]     = useState('')

  // Business header editing
  const [editingName,  setEditingName]  = useState(false)
  const [nameValue,    setNameValue]    = useState('')
  const [nameSaving,   setNameSaving]   = useState(false)
  const [logoUploading,setLogoUploading]= useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id || !bizId) return
    Promise.all([
      fetch('/api/businesses').then((r) => r.json()),
      fetch(`/api/employees?businessId=${bizId}`).then((r) => r.json()),
    ]).then(([bizData, empData]) => {
      const found = (bizData.businesses ?? []).find((b: Business & { logoUrl?: string | null }) => b.id === bizId)
      if (!found) { router.push('/businesses'); return }
      setBusiness(found)
      setEmployees(empData.employees ?? [])
    }).finally(() => setLoading(false))
  }, [user?.id, bizId])

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
        body:    JSON.stringify({ name, walletAddress: finalAddress, salary, role: role || undefined, businessId: bizId, preferredChain, preferredToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => [...prev, data.employee])
      clearAddForm()
      setResolvedAddress(''); setResolvedName(''); setLookupState('idle')
      setShowForm(false)
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
    setEditState({ name: emp.name, walletAddress: emp.walletAddress, salary: emp.salary, role: emp.role ?? '', preferredChain: emp.preferredChain ?? 'ARC-TESTNET', preferredToken: emp.preferredToken ?? 'USDC' })
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

  async function saveBusinessName() {
    if (!nameValue.trim() || !business) return
    setNameSaving(true)
    try {
      const res  = await fetch(`/api/businesses/${bizId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: nameValue.trim() }),
      })
      const data = await res.json()
      if (res.ok) { setBusiness(data.business); setEditingName(false) }
    } finally { setNameSaving(false) }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append('logo', file)
      const res  = await fetch(`/api/businesses/${bizId}/logo`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) setBusiness((prev) => prev ? { ...prev, logoUrl: data.business.logoUrl } : prev)
    } finally { setLogoUploading(false) }
  }

  const totalUsdcSalary = employees.filter(e => (e.preferredToken ?? 'USDC') === 'USDC').reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalEurcSalary = employees.filter(e => e.preferredToken === 'EURC').reduce((s, e) => s + parseFloat(e.salary), 0)
  const totalSalary = (totalUsdcSalary + totalEurcSalary).toFixed(2)
  const { theme } = useTheme()
  const L = theme === 'light'
  const card  = { background: L ? '#ffffff' : 'rgba(18,32,49,0.6)', border: `1px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}` }
  const input = { background: L ? '#ffffff' : 'rgba(18,32,49,0.6)', border: `1px solid ${L ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'}`, color: L ? '#0b1e47' : '#ffffff' }
  const t1    = L ? '#0b1e47' : '#ffffff'
  const t2    = L ? '#45607a' : '#8faab8'
  const t3    = L ? '#637d96' : '#45607a'
  const divider = L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
  const rowHover = L ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/businesses')}
        className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-400 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Businesses
      </button>

      {/* Hidden logo file input */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

      {/* Business identity header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Logo with upload on click */}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden transition"
            style={{ background: business?.logoUrl ? 'transparent' : 'rgba(42,171,171,0.15)', border: `2px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}` }}
            title="Change photo"
          >
            {logoUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            ) : business?.logoUrl ? (
              <>
                <img src={business.logoUrl} alt={business.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 opacity-0 group-hover:opacity-100 transition">
                  <Camera className="h-4 w-4 text-white" />
                  <span className="text-[9px] text-white font-medium">Change</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-brand-400">{business?.name[0].toUpperCase()}</span>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-2xl">
                  <Camera className="h-4 w-4 text-white" />
                  <span className="text-[9px] text-white font-medium">Upload</span>
                </div>
              </>
            )}
          </button>

          {/* Name + subtitle */}
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveBusinessName(); if (e.key === 'Escape') setEditingName(false) }}
                  className="input-base text-lg font-semibold py-1.5"
                  style={{ color: t1, background: L ? '#ffffff' : 'rgba(18,32,49,0.6)', border: `1px solid ${L ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}` }}
                  maxLength={100}
                />
                <button onClick={saveBusinessName} disabled={nameSaving} className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-500/10 transition">
                  {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="rounded-lg p-1.5 transition" style={{ color: t3 }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: t1 }}>{business?.name}</h1>
                <button
                  onClick={() => { setEditingName(true); setNameValue(business?.name ?? '') }}
                  className="rounded-lg p-1 transition opacity-0 group-hover:opacity-100 hover:opacity-100"
                  style={{ color: t3 }}
                  title="Rename"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="mt-0.5 text-sm" style={{ color: t2 }}>Manage employees and their salaries.</p>
          </div>
        </div>

        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition shrink-0"
        >
          <UserPlus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl px-6 py-4" style={card}>
          <div className="text-2xl font-bold" style={{ color: t1 }}>{employees.length}</div>
          <div className="mt-0.5 text-sm" style={{ color: t2 }}>Total employees</div>
        </div>
        <div className="rounded-2xl px-6 py-4" style={card}>
          <div className="text-2xl font-bold" style={{ color: t1 }}>${totalSalary}</div>
          <div className="mt-0.5 text-sm" style={{ color: t2 }}>Total per payroll run</div>
        </div>
      </div>

      {/* Add employee form */}
      {showForm && (
        <div className="mb-6 rounded-2xl p-5" style={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: t1 }}>New Employee</h2>
            <button onClick={() => { setShowForm(false); setError('') }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <div className="mb-3 rounded-xl bg-red-900/30 px-4 py-2.5 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
            <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="input-base" required maxLength={100} style={input} />
            <input type="text" placeholder="Role (e.g. Engineer)" value={role} onChange={(e) => setRole(e.target.value)} className="input-base" maxLength={100} style={input} />
            <div className="sm:col-span-2">
              <div className="mb-2 flex gap-1 rounded-xl p-1" style={{ background: L ? '#eef2f7' : '#0d1926', border: `1px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(42,171,171,0.12)'}` }}>
                <button type="button" onClick={() => setWalletMode('address')}
                  className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                    walletMode === 'address' ? 'bg-brand-500/15 text-brand-400' : '')}
                  style={walletMode !== 'address' ? { color: t3 } : {}}>
                  <Wallet className="h-3 w-3" /> Wallet Address
                </button>
                <button type="button" onClick={() => setWalletMode('username')}
                  className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                    walletMode === 'username' ? 'bg-brand-500/15 text-brand-400' : '')}
                  style={walletMode !== 'username' ? { color: t3 } : {}}>
                  <AtSign className="h-3 w-3" /> Architect Pay Username
                </button>
              </div>
              {walletMode === 'address' ? (
                <input type="text" placeholder="Wallet address (0x...)" value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-base font-mono text-xs" pattern="^0x[a-fA-F0-9]{40}$" title="Valid EVM address" required style={input} />
              ) : (
                <div>
                  <div className="flex items-center input-base overflow-hidden p-0" style={input}>
                    <span className="flex h-full items-center px-3 text-sm shrink-0" style={{ color: t3, borderRight: `1px solid ${divider}`, background: L ? '#f0f4f8' : 'rgba(255,255,255,0.04)' }}>@</span>
                    <input type="text" placeholder="username" value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                      style={{ color: t1 }}
                      autoComplete="off" required />
                  </div>
                  {lookupState === 'loading' && <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Looking up...</div>}
                  {lookupState === 'found' && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-green-900/20 px-3 py-1.5 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                      <span className="font-medium text-green-300">{resolvedName}</span>
                      <span className="text-gray-500 font-mono">{resolvedAddress.slice(0,8)}…{resolvedAddress.slice(-6)}</span>
                    </div>
                  )}
                  {lookupState === 'notfound' && usernameInput.length >= 3 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400"><XCircle className="h-3 w-3 shrink-0" /> User not found.</div>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: t3 }}>$</span>
              <input type="number" step="0.01" min="0.01" placeholder="Salary amount" value={salary} onChange={(e) => setSalary(e.target.value)} className="input-base pl-7" required style={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: t3 }}>Payment token</label>
              <div className="flex gap-2">
                {(['USDC', 'EURC'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setPreferredToken(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold transition ${preferredToken === t ? 'border-brand-500/50 bg-brand-500/10 text-brand-400' : 'border-gray-700 bg-gray-800/40 text-gray-500 hover:text-gray-300'}`}
                    style={preferredToken !== t ? { borderColor: L ? 'rgba(0,0,0,0.1)' : undefined } : {}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative sm:col-span-2">
              <label className="mb-1 block text-xs font-medium" style={{ color: t3 }}>Preferred payment chain</label>
              <select value={preferredChain} onChange={(e) => setPreferredChain(e.target.value)} className="input-base w-full" style={input}>
                {CHAIN_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <button type="submit"
              disabled={saving || (walletMode === 'username' && lookupState !== 'found')}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? 'Adding...' : 'Add Employee'}
            </button>
          </form>
        </div>
      )}

      {/* Employee table */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
            <UserPlus className="h-7 w-7 text-gray-600" />
          </div>
          <p className="mb-1 text-sm font-medium text-gray-300">No employees yet</p>
          <p className="mb-5 text-xs text-gray-600">Add your first employee to start running payroll.</p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition">
            <UserPlus className="h-4 w-4" /> Add Employee
          </button>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={card}>
          {/* Table header */}
          <div className="grid grid-cols-[180px_1fr_100px_64px] items-center gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide" style={{ borderBottom: `1px solid ${divider}`, background: L ? '#f5f8fb' : 'rgba(18,32,49,0.6)', color: t3 }}>
            <span>Employee</span>
            <span>Wallet</span>
            <span className="text-right">Salary/run</span>
            <span />
          </div>

          <div style={{ background: L ? '#ffffff' : 'rgba(12,24,38,0.3)' }}>
            {employees.map((emp) =>
              editingId === emp.id && editState ? (
                <div key={emp.id} style={{ borderTop: `1px solid ${divider}` }}>
                  {editError && <div className="mx-6 mt-3 rounded-xl bg-red-900/30 px-3 py-2 text-xs text-red-400">{editError}</div>}
                  <div className="grid grid-cols-[180px_1fr_100px_64px] items-center gap-4 px-6 py-3" style={{ background: L ? '#eef4ff' : 'rgba(30,58,138,0.08)' }}>
                    {/* Name + role stacked — matches 180px employee column */}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <input type="text" value={editState.name} onChange={(e) => setEditState({ ...editState, name: e.target.value })} placeholder="Full name" className="input-base text-sm" maxLength={100} style={input} />
                      <input type="text" value={editState.role} onChange={(e) => setEditState({ ...editState, role: e.target.value })} placeholder="Role" className="input-base text-xs" maxLength={100} style={input} />
                    </div>
                    {/* Wallet + chain + token — matches 1fr wallet column */}
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <input type="text" value={editState.walletAddress} onChange={(e) => setEditState({ ...editState, walletAddress: e.target.value })} placeholder="0x..." className="input-base font-mono text-xs w-full" style={input} />
                      <div className="flex gap-1.5">
                        <select value={editState.preferredChain} onChange={(e) => setEditState({ ...editState, preferredChain: e.target.value })} className="input-base text-xs flex-1" style={input}>
                          {CHAIN_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <select value={editState.preferredToken} onChange={(e) => setEditState({ ...editState, preferredToken: e.target.value })} className="input-base text-xs w-20" style={input}>
                          <option value="USDC">USDC</option>
                          <option value="EURC">EURC</option>
                        </select>
                      </div>
                    </div>
                    {/* Salary — matches 100px salary column */}
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: t3 }}>$</span>
                      <input type="number" step="0.01" min="0.01" value={editState.salary} onChange={(e) => setEditState({ ...editState, salary: e.target.value })} className="input-base pl-5 text-xs w-full text-right" style={input} />
                    </div>
                    {/* Save / Cancel icons — matches 64px actions column */}
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => saveEdit(emp.id)} disabled={editSaving} className="rounded-lg p-1.5 bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50">
                        {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={cancelEdit} className="rounded-lg p-1.5 transition" style={{ border: `1px solid ${divider}`, color: t2 }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={emp.id} className="grid grid-cols-[180px_1fr_100px_64px] items-center gap-4 px-6 py-4 transition" style={{ borderTop: `1px solid ${divider}` }} onMouseEnter={e => (e.currentTarget.style.background = rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Employee info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-400">
                      {emp.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate" style={{ color: t1 }}>{emp.name}</div>
                      {emp.role && <div className="text-xs truncate" style={{ color: t3 }}>{emp.role}</div>}
                    </div>
                  </div>

                  {/* Wallet + preferred chain */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs truncate" style={{ color: t3 }}>{emp.walletAddress}</span>
                      <button onClick={() => copyAddress(emp.id, emp.walletAddress)} className="shrink-0 rounded p-0.5 hover:text-brand-400 transition" style={{ color: t3 }}>
                        {copiedId === emp.id ? <CheckCheck className="h-3 w-3 text-brand-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <ChainLogo chain={emp.preferredChain ?? 'ARC-TESTNET'} size={10} />
                      <span className="text-[10px]" style={{ color: t3 }}>{CHAIN_OPTIONS.find((c) => c.value === emp.preferredChain)?.label ?? 'Arc Testnet'}</span>
                    </div>
                  </div>

                  {/* Salary */}
                  <div className="text-right">
                    <span className="font-semibold" style={{ color: t1 }}>${parseFloat(emp.salary).toFixed(2)}</span>
                    <div className="text-xs" style={{ color: t3 }}>{emp.preferredToken ?? 'USDC'}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(emp)} className="rounded-lg p-1.5 transition" style={{ color: t3 }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="rounded-lg p-1.5 hover:bg-red-900/20 hover:text-red-400 transition" style={{ color: t3 }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${divider}`, background: L ? '#f5f8fb' : 'rgba(18,32,49,0.6)' }}>
            <span className="text-xs" style={{ color: t3 }}>{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
            <span className="text-xs font-medium" style={{ color: t2 }}>
              Total:{' '}
              {totalUsdcSalary > 0 && <span style={{ color: t1 }}>${totalUsdcSalary.toFixed(2)} USDC</span>}
              {totalUsdcSalary > 0 && totalEurcSalary > 0 && <span style={{ color: t2 }}> + </span>}
              {totalEurcSalary > 0 && <span style={{ color: t1 }}>${totalEurcSalary.toFixed(2)} EURC</span>}
              {' '}per run
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
