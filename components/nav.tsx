'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { LayoutDashboard, Send, History, Building2, Banknote, LogOut, Droplets, Settings, MessageSquare, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/payments',   label: 'Send Payment', icon: Send },
  { href: '/businesses', label: 'Businesses',   icon: Building2 },
  { href: '/payroll',    label: 'Payroll',       icon: Banknote },
  { href: '/history',    label: 'History',       icon: History },
  { href: '/swap',       label: 'Swap',          icon: ArrowUpDown },
  { href: '/settings',   label: 'Settings',      icon: Settings },
  { href: '/feedback',   label: 'Feedback',      icon: MessageSquare },
]

export default function Nav() {
  const pathname    = usePathname()
  const { logout, user } = useAuth()

  return (
    <aside
      className="flex h-screen w-56 flex-col px-3 py-6"
      style={{
        background:  'linear-gradient(180deg, #0b1829 0%, #081422 60%, #060f1c 100%)',
        borderRight: '1px solid rgba(42,171,171,0.12)',
      }}
    >
      {/* Logo */}
      <div className="mb-8 px-3">
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

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
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
