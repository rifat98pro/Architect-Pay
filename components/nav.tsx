'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useBusiness } from '@/context/business-context'
import { LayoutDashboard, Send, History, Users, Banknote, LogOut, Droplets, Building2, Plus, ChevronDown, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/payments',  label: 'Send Payment', icon: Send },
  { href: '/employees', label: 'Employees',    icon: Users },
  { href: '/payroll',   label: 'Payroll',      icon: Banknote },
  { href: '/history',   label: 'History',      icon: History },
]

export default function Nav() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { businesses, selectedId, selected, setSelectedId, refresh } = useBusiness()

  const [bizOpen,     setBizOpen]     = useState(false)
  const [newBizName,  setNewBizName]  = useState('')
  const [addingBiz,   setAddingBiz]   = useState(false)
  const [showAdd,     setShowAdd]     = useState(false)
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving,setRenameSaving]= useState(false)

  async function createBusiness() {
    if (!newBizName.trim()) return
    setAddingBiz(true)
    try {
      const res  = await fetch('/api/businesses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newBizName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        await refresh()
        setSelectedId(data.business.id)
        setNewBizName('')
        setShowAdd(false)
        setBizOpen(false)
      }
    } finally {
      setAddingBiz(false)
    }
  }

  async function deleteBusiness(id: string) {
    await fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    if (selectedId === id) setSelectedId(null)
    await refresh()
  }

  function startRename(biz: { id: string; name: string }) {
    setRenamingId(biz.id)
    setRenameValue(biz.name)
  }

  async function saveRename(id: string) {
    if (!renameValue.trim()) return
    setRenameSaving(true)
    try {
      await fetch(`/api/businesses/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: renameValue.trim() }),
      })
      await refresh()
      setRenamingId(null)
    } finally {
      setRenameSaving(false)
    }
  }

  return (
    <aside
      className="flex h-screen w-56 flex-col px-3 py-6"
      style={{
        background:  'linear-gradient(180deg, #0b1829 0%, #081422 60%, #060f1c 100%)',
        borderRight: '1px solid rgba(42,171,171,0.12)',
      }}
    >
      {/* Logo */}
      <div className="mb-4 px-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-brand-500/30 to-navy-800/30 blur-sm" />
            <Image src="/logo.png" alt="Architect Pay" width={32} height={32} className="relative rounded-lg object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: '#ffffff' }}>Architect</span>
            <span style={{ color: '#2aabab' }}> Pay</span>
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 px-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(42,171,171,0.8)]" />
          <span className="text-xs text-gray-500">Arc Testnet</span>
        </div>
      </div>

      {/* Business selector */}
      <div className="mb-4 px-1 relative">
        <button
          onClick={() => setBizOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-gray-800/40"
          style={{ border: '1px solid rgba(42,171,171,0.15)' }}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          <span className="flex-1 truncate text-xs font-medium text-gray-300">
            {selected ? selected.name : 'All Businesses'}
          </span>
          <ChevronDown className={cn('h-3 w-3 text-gray-500 transition-transform', bizOpen && 'rotate-180')} />
        </button>

        {bizOpen && (
          <div
            className="absolute left-1 right-1 top-full z-50 mt-1 rounded-xl py-1 shadow-xl"
            style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.2)' }}
          >
            {/* All option */}
            <button
              onClick={() => { setSelectedId(null); setBizOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-brand-500/10',
                !selectedId ? 'text-brand-400' : 'text-gray-400',
              )}
            >
              <span className="flex-1 text-left">All Businesses</span>
              {!selectedId && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </button>

            {businesses.map((biz) => (
              <div key={biz.id} className="px-2 py-0.5">
                {renamingId === biz.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(biz.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="input-base flex-1 py-1 text-xs"
                      maxLength={100}
                    />
                    <button
                      onClick={() => saveRename(biz.id)}
                      disabled={renameSaving}
                      className="rounded p-1 text-brand-400 hover:text-brand-300 transition"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="rounded p-1 text-gray-500 hover:text-gray-300 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedId(biz.id); setBizOpen(false) }}
                      className={cn(
                        'flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-brand-500/10',
                        selectedId === biz.id ? 'text-brand-400' : 'text-gray-400',
                      )}
                    >
                      <span className="flex-1 truncate text-left">{biz.name}</span>
                      {selectedId === biz.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    </button>
                    <button
                      onClick={() => startRename(biz)}
                      className="rounded p-1 text-gray-600 hover:text-brand-400 transition"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteBusiness(biz.id)}
                      className="rounded p-1 text-gray-600 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div className="mx-2 my-1 h-px bg-gray-800" />

            {showAdd ? (
              <div className="px-2 pb-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Business name"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBusiness()}
                  className="input-base mb-1.5 w-full text-xs py-1.5"
                  maxLength={100}
                />
                <div className="flex gap-1">
                  <button
                    onClick={createBusiness}
                    disabled={addingBiz || !newBizName.trim()}
                    className="btn-primary flex-1 py-1 text-xs"
                  >
                    {addingBiz ? 'Adding...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setNewBizName('') }}
                    className="btn-secondary py-1 text-xs px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-500 transition hover:text-brand-400"
              >
                <Plus className="h-3 w-3" />
                New Business
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active ? 'text-brand-400' : 'text-gray-400 hover:text-white',
              )}
              style={active ? {
                background:  'linear-gradient(90deg, rgba(42,171,171,0.12) 0%, rgba(42,171,171,0.04) 100%)',
                borderLeft:  '2px solid #2aabab',
                paddingLeft: '10px',
                boxShadow:   'inset 0 0 20px rgba(42,171,171,0.05)',
              } : {}}
            >
              <Icon className={cn('h-4 w-4 transition-all duration-200', active ? 'text-brand-400 drop-shadow-[0_0_6px_rgba(42,171,171,0.6)]' : 'group-hover:text-brand-500')} />
              {label}
            </Link>
          )
        })}

        <div className="my-2 mx-3 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-800/50 hover:text-white"
        >
          <Droplets className="h-4 w-4 group-hover:text-brand-500 transition" />
          Get Faucet
        </a>
      </nav>

      {/* User + logout */}
      <div
        className="mt-4 rounded-xl p-3"
        style={{ background: 'rgba(42,171,171,0.04)', border: '1px solid rgba(42,171,171,0.08)' }}
      >
        {user && (
          <div className="mb-3">
            <div className="text-sm font-medium text-white truncate">{user.name ?? user.email}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-800/60 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
