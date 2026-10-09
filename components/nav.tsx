'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { LayoutDashboard, Send, History, Building2, Banknote, LogOut, Droplets, Settings, MessageSquare, ArrowUpDown, LifeBuoy, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-context'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, color: '#2aabab' },
  { href: '/payments',   label: 'Send Payment', icon: Send,            color: '#3b82f6' },
  { href: '/businesses', label: 'Businesses',   icon: Building2,       color: '#8b5cf6' },
  { href: '/payroll',    label: 'Payroll',       icon: Banknote,        color: '#10b981' },
  { href: '/history',    label: 'History',       icon: History,         color: '#f59e0b' },
  { href: '/swap',       label: 'Swap',          icon: ArrowUpDown,     color: '#6366f1' },
  { href: '/settings',   label: 'Settings',      icon: Settings,        color: '#64748b' },
  { href: '/feedback',   label: 'Feedback',      icon: MessageSquare,   color: '#ec4899' },
  { href: '/support',    label: 'Support',       icon: LifeBuoy,        color: '#f97316' },
]

export default function Nav() {
  const pathname         = usePathname()
  const { logout, user } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <aside
      className="flex h-screen w-56 flex-col px-3 py-6"
      style={{
        background:  theme === 'light'
          ? '#ffffff'
          : 'linear-gradient(180deg, #0b1829 0%, #081422 60%, #060f1c 100%)',
        borderRight: theme === 'light'
          ? '1px solid rgba(0,0,0,0.08)'
          : '1px solid rgba(42,171,171,0.12)',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* Logo */}
      <div className="mb-8 px-3">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-brand-500/30 to-navy-800/30 blur-sm" />
            <Image src="/logo.png" alt="Architect Pay" width={32} height={32} className="relative rounded-lg object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>Architect</span>
            <span style={{ color: '#2aabab' }}> Pay</span>
          </span>
        </Link>
        <div className="mt-1 flex items-center gap-1.5 px-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(42,171,171,0.8)]" />
          <span className="text-xs text-gray-500">Mainnet</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const L = theme === 'light'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? (L ? 'text-gray-900' : 'text-white')
                  : (L ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'),
              )}
              style={active ? {
                background: L
                  ? `${color}18`
                  : `linear-gradient(90deg, ${color}18 0%, ${color}08 100%)`,
                borderLeft: `2px solid ${color}`,
                paddingLeft: '8px',
              } : {}}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  background: active
                    ? `${color}28`
                    : L ? `${color}14` : `${color}18`,
                  boxShadow: active ? `0 0 8px ${color}40` : 'none',
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 transition-all duration-200"
                  style={{ color: active ? color : `${color}bb` }}
                />
              </span>
              {label}
            </Link>
          )
        })}

        <div className="my-2 mx-3 h-px" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)' }} />

        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${theme === 'light' ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
            style={{ background: '#06b6d418', boxShadow: 'none' }}>
            <Droplets className="h-3.5 w-3.5 transition-colors duration-200" style={{ color: '#06b6d4bb' }} />
          </span>
          Get Faucet
        </a>
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className={`mb-3 flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${theme === 'light' ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: theme === 'dark' ? '#fbbf2418' : '#818cf818' }}>
            {theme === 'dark'
              ? <Sun  className="h-3.5 w-3.5" style={{ color: '#fbbf24bb' }} />
              : <Moon className="h-3.5 w-3.5" style={{ color: '#818cf8bb' }} />}
          </span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </span>
        <span className="flex h-5 w-9 items-center rounded-full px-0.5 transition-all"
          style={{ background: theme === 'light' ? '#2aabab' : 'rgba(255,255,255,0.1)' }}>
          <span className="h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: theme === 'light' ? 'translateX(16px)' : 'translateX(0)' }} />
        </span>
      </button>

      {/* User + logout */}
      <div
        className="mt-4 rounded-xl p-3"
        style={{
          background: theme === 'light' ? '#f0f4f8' : 'rgba(42,171,171,0.04)',
          border: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(42,171,171,0.08)',
        }}
      >
        {user && (
          <div className="mb-3 flex items-center gap-2.5">
            <div
              className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
              style={{
                border: theme === 'light' ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
                background: theme === 'light' ? '#dde6f0' : '#1a2d44',
              }}
            >
              {user.image ? (
                <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-400">
                  {(user.name ?? user.email ?? '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: theme === 'light' ? '#0b1e47' : '#ffffff' }}>{user.name ?? user.email}</div>
              <div className="text-xs truncate" style={{ color: theme === 'light' ? '#637d96' : '#45607a' }}>{user.email}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 ${theme === 'light' ? 'text-gray-500 hover:text-red-600' : 'text-gray-500 hover:text-red-400'}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: '#ef444418' }}>
            <LogOut className="h-3.5 w-3.5" style={{ color: '#ef4444bb' }} />
          </span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
