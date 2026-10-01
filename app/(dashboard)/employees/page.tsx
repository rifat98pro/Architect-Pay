'use client'

import { useEffect, useState } from 'react'
import { useFormPersist } from '@/lib/hooks/use-form-persist'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { UserPlus, Trash2, Loader2, Pencil, Check, X, Copy, CheckCheck } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'
import { useBusiness } from '@/context/business-context'

interface Employee {
  id:            string
  name:          string
  walletAddress: string
  salary:        string
  role:          string | null
}

interface EditState {
  name:          string
  walletAddress: string
  salary:        string
  role:          string
}

export default function EmployeesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { selectedId: businessId, selected: business } = useBusiness()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const [addForm, setAddForm, clearAddForm] = useFormPersist('employees-add', { name: '', address: '', salary: '', role: '' })
  const { name, address, salary, role } = addForm
  const setName    = (v: string) => setAddForm({ name: v })
  const setAddress = (v: string) => setAddForm({ address: v })
  const setSalary  = (v: string) => setAddForm({ salary: v })
  const setRole    = (v: string) => setAddForm({ role: v })

  const [copiedId,     setCopiedId]     = useState<string | null>(null)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editState,    setEditState]    = useState<EditState | null>(null)
  const [editSaving,   setEditSaving]   = useState(false)
  const [editError,    setEditError]    = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const url = businessId ? `/api/employees?businessId=${businessId}` : '/api/employees'
    fetch(url)
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []))
      .finally(() => setLoading(false))
  }, [user?.id, businessId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, walletAddress: address, salary, role: role || undefined, businessId: businessId ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => [...prev, data.employee])
      clearAddForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditError('')
    setEditState({
      name:          emp.name,
      walletAddress: emp.walletAddress,
      salary:        emp.salary,
      role:          emp.role ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
    setEditError('')
  }

  async function saveEdit(id: string) {
    if (!editState) return
    setEditError('')
    setEditSaving(true)
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:          editState.name,
          walletAddress: editState.walletAddress,
          salary:        editState.salary,
          role:          editState.role || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => prev.map((e) => e.id === id ? data.employee : e))
      setEditingId(null)
      setEditState(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  function copyAddress(id: string, address: string) {
    navigator.clipboard.writeText(address)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  const totalSalary = employees.reduce((s, e) => s + parseFloat(e.salary), 0).toFixed(2)

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold text-white">
        {business ? business.name : 'All Employees'}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        {business
          ? `Managing employees for ${business.name}. Select a business from the sidebar to switch.`
          : 'Showing all employees across businesses. Select a business from the sidebar to filter.'}
      </p>

      {/* Add Employee */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Add Employee</h2>
        {error && (
          <div className="mb-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            required
            maxLength={100}
          />
          <input
            type="text"
            placeholder="Employee role (e.g. Engineer, Designer)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-base"
            maxLength={100}
          />
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-base font-mono text-xs"
            pattern="^0x[a-fA-F0-9]{40}$"
            title="Valid EVM address"
            required
          />
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Salary (USDC)"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="input-base pr-8"
              required
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary sm:col-span-2 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? 'Adding...' : 'Add Employee'}
          </button>
        </form>
      </div>

      {/* Employee list */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : employees.length === 0 ? (
        <div className="card py-12 text-center text-sm text-gray-500">
          No employees yet. Add your first employee above.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <span className="text-sm font-medium text-gray-400">{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-semibold text-white">Total payroll: ${totalSalary} USDC</span>
          </div>
          <div className="divide-y divide-gray-800">
            {employees.map((emp) =>
              editingId === emp.id && editState ? (
                // ── Edit row ──────────────────────────────────────────────
                <div key={emp.id} className="px-5 py-4 space-y-3" style={{ background: 'rgba(42,171,171,0.04)' }}>
                  {editError && (
                    <div className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{editError}</div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editState.name}
                      onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                      placeholder="Full name"
                      className="input-base text-sm"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={editState.role}
                      onChange={(e) => setEditState({ ...editState, role: e.target.value })}
                      placeholder="Employee role"
                      className="input-base text-sm"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={editState.walletAddress}
                      onChange={(e) => setEditState({ ...editState, walletAddress: e.target.value })}
                      placeholder="Wallet address (0x...)"
                      className="input-base font-mono text-xs"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editState.salary}
                        onChange={(e) => setEditState({ ...editState, salary: e.target.value })}
                        placeholder="Salary (USDC)"
                        className="input-base pr-8 text-sm"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(emp.id)}
                      disabled={editSaving}
                      className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                    >
                      {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // ── Normal row ────────────────────────────────────────────
                <div key={emp.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-500">
                    {emp.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">{emp.name}</div>
                    {emp.role && (
                      <div className="text-xs font-medium text-brand-400">{emp.role}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-500">{truncateAddress(emp.walletAddress, 8)}</span>
                      <button
                        onClick={() => copyAddress(emp.id, emp.walletAddress)}
                        className="rounded p-0.5 text-gray-600 transition hover:text-brand-400"
                        title="Copy wallet address"
                      >
                        {copiedId === emp.id
                          ? <CheckCheck className="h-3 w-3 text-brand-400" />
                          : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">${parseFloat(emp.salary).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">per run</div>
                  </div>
                  <button
                    onClick={() => startEdit(emp)}
                    className="ml-1 rounded-lg p-1.5 text-gray-600 transition hover:bg-brand-500/10 hover:text-brand-400"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(emp.id)}
                    className="rounded-lg p-1.5 text-gray-600 transition hover:bg-red-900/20 hover:text-red-400"
                  >
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
