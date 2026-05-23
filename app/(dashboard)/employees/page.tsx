'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { UserPlus, Trash2, Loader2 } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'

interface Employee {
  id:            string
  name:          string
  walletAddress: string
  salary:        string
}

export default function EmployeesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [salary,  setSalary]  = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []))
      .finally(() => setLoading(false))
  }, [user])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, walletAddress: address, salary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setEmployees((prev) => [...prev, data.employee])
      setName(''); setAddress(''); setSalary('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  const totalSalary = employees.reduce((s, e) => s + parseFloat(e.salary), 0).toFixed(2)

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Employees</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage your payroll roster. Each employee will receive their salary in USDC on Arc Testnet.
      </p>

      {/* Add employee form */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Add Employee</h2>
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            required
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
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Salary (USDC)"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="input-base pl-7"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary sm:col-span-3 flex items-center justify-center gap-2"
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
        <div className="card py-12 text-center text-sm text-gray-400">
          No employees yet. Add your first employee above.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <span className="text-sm font-medium text-gray-700">{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-semibold text-gray-900">Total payroll: ${totalSalary} USDC</span>
          </div>
          <div className="divide-y divide-gray-100">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {emp.name[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{emp.name}</div>
                  <div className="font-mono text-xs text-gray-400">{truncateAddress(emp.walletAddress, 8)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${parseFloat(emp.salary).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">per run</div>
                </div>
                <button
                  onClick={() => handleDelete(emp.id)}
                  className="ml-2 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
