'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import {
  LayoutDashboard,
  Send,
  Building2,
  Users,
  Banknote,
  ArrowUpDown,
  ArrowLeftRight,
  History,
  Settings,
  MessageSquare,
  LifeBuoy,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-context'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, color: '#2aabab' },
  { href: '/payments',   label: 'Send Payment', icon: Send,            color: '#3b82f6' },
  { href: '/businesses', label: 'Businesses',   icon: Building2,       color: '#8b5cf6' },
  { href: '/employees',  label: 'Employees',    icon: Users,           color: '#06b6d4' },
  { href: '/payroll',    label: 'Payroll',       icon: Banknote,        color: '#10b981' },
  { href: '/swap',       label: 'Swap',          icon: ArrowUpDown,     color: '#6366f1' },
  { href: '/withdraw',   label: 'Bridge',        icon: ArrowLeftRight,  color: '#ec4899' },
  { href: '/history',    label: 'History',       icon: History,         color: '#f59e0b' },
  { href: '/settings',   label: 'Settings',      icon: Settings,        color: '#64748b' },
  { href: '/feedback',   label: 'Feedback',      icon: MessageSquare,   color: '#a855f7' },
  { href: '/support',    label: 'Support',       icon: LifeBuoy,        color: '#f97316' },
]

export default function Nav() {
  const pathname          = usePathname()
  const { logout, user }  = useAuth()
  const { theme, toggle } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef         = useRef<HTMLDivElement>(null)
  const triggerRef        = useRef<HTMLButtonElement>(null)

  // Close menu automatically whenever route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Move focus into drawer when opened
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [isOpen])

  const L = theme === 'light'

  const navLinks = (onItemClick?: () => void) => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
      {navItems.map(({ href, label, icon: Icon, color }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onItemClick}
            className={cn(
              'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200',
              active
                ? (L ? 'text-gray-900 font-semibold' : 'text-white font-semibold')
                : (L ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-gray-400 hover:text-white hover:bg-white/5'),
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
                  : L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                boxShadow: active ? `0 0 8px ${color}40` : 'none',
              }}
            >
              <Icon
                className="h-3.5 w-3.5 transition-all duration-200"
                style={{ color: active ? color : L ? '#64748b' : '#6b8299' }}
              />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const themeToggleButton = (
    <button
      onClick={toggle}
      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
        L ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: theme === 'dark' ? '#fbbf2418' : '#818cf818' }}
        >
          {theme === 'dark'
            ? <Sun  className="h-3.5 w-3.5" style={{ color: '#fbbf24bb' }} />
            : <Moon className="h-3.5 w-3.5" style={{ color: '#818cf8bb' }} />}
        </span>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </span>
      <span
        className="flex h-5 w-9 items-center rounded-full px-0.5 transition-all"
        style={{ background: L ? '#2aabab' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: L ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  )

  const userProfileCard = (onLogoutClick?: () => void) => (
    <div
      className="mt-3 rounded-xl p-3"
      style={{
        background: L ? '#f0f4f8' : 'rgba(42,171,171,0.04)',
        border: L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(42,171,171,0.08)',
      }}
    >
      {user && (
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
            style={{
              border: L ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
              background: L ? '#dde6f0' : '#1a2d44',
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
            <div className="text-sm font-medium truncate" style={{ color: L ? '#0b1e47' : '#ffffff' }}>
              {user.name ?? user.email}
            </div>
            <div className="text-xs truncate" style={{ color: L ? '#637d96' : '#45607a' }}>
              {user.email}
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => {
          onLogoutClick?.()
          logout()
        }}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 ${
          L ? 'text-gray-600 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: '#ef444418' }}>
          <LogOut className="h-3.5 w-3.5" style={{ color: '#ef4444bb' }} />
        </span>
        Sign out
      </button>
    </div>
  )

  return (
    <>
      {/* ── MOBILE TOP NAVIGATION BAR (< md) ─────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b px-4 backdrop-blur-xl transition-colors duration-200 md:hidden"
        style={{
          background: L ? 'rgba(255, 255, 255, 0.95)' : 'rgba(11, 24, 41, 0.95)',
          borderColor: L ? 'rgba(0, 0, 0, 0.08)' : 'rgba(42, 171, 171, 0.15)',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
          <div
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={L ? { border: '1px solid rgba(0,0,0,0.1)' } : {}}
          >
            <Image src="/logo.png" alt="Architect Pay" width={28} height={28} className="rounded-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">
              <span style={{ color: L ? '#0b1e47' : '#ffffff' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(42,171,171,0.8)]" />
              Mainnet
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Quick theme toggle */}
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
            style={{
              background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
              border: L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" style={{ color: '#fbbf24' }} />
            ) : (
              <Moon className="h-4 w-4" style={{ color: '#818cf8' }} />
            )}
          </button>

          {/* Hamburger button */}
          <button
            ref={triggerRef}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
            style={{
              background: L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
              border: L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(42,171,171,0.25)',
              color: L ? '#0b1e47' : '#ffffff',
            }}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── MOBILE MENU BACKDROP OVERLAY (< md) ───────────────────────── */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* ── MOBILE MENU SLIDE-IN DRAWER (< md) ────────────────────────── */}
      <aside
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col p-4 shadow-2xl transition-transform duration-300 ease-in-out outline-none md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: L
            ? '#ffffff'
            : 'linear-gradient(180deg, #0b1829 0%, #081422 60%, #060f1c 100%)',
          borderRight: L
            ? '1px solid rgba(0,0,0,0.08)'
            : '1px solid rgba(42,171,171,0.18)',
        }}
      >
        {/* Drawer header */}
        <div className="mb-4 flex items-center justify-between border-b pb-3 px-1"
          style={{ borderColor: L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
          >
            <div
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={L ? { border: '1px solid rgba(0,0,0,0.1)' } : {}}
            >
              <Image src="/logo.png" alt="Architect Pay" width={28} height={28} className="rounded-full object-contain" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span style={{ color: L ? '#0b1e47' : '#ffffff' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </Link>

          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: L ? '#475569' : '#94a3b8' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable nav items list */}
        {navLinks(() => setIsOpen(false))}

        {/* Bottom actions: Theme + User */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
          {themeToggleButton}
          {userProfileCard(() => setIsOpen(false))}
        </div>
      </aside>

      {/* ── DESKTOP SIDEBAR (>= md) ──────────────────────────────────── */}
      <aside
        className="hidden md:flex h-screen w-56 flex-col px-3 py-6 shrink-0 sticky top-0"
        style={{
          background: L
            ? '#ffffff'
            : 'linear-gradient(180deg, #0b1829 0%, #081422 60%, #060f1c 100%)',
          borderRight: L
            ? '1px solid rgba(0,0,0,0.08)'
            : '1px solid rgba(42,171,171,0.12)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {/* Logo */}
        <div className="mb-8 px-3">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={L ? { border: '1.5px solid rgba(0,0,0,0.12)' } : {}}
            >
              <Image src="/logo.png" alt="Architect Pay" width={32} height={32} className="rounded-full object-contain" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span style={{ color: L ? '#0b1e47' : '#ffffff' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </Link>
          <div className="mt-1 flex items-center gap-1.5 px-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(42,171,171,0.8)]" />
            <span className="text-xs text-gray-500">Mainnet</span>
          </div>
        </div>

        {/* Desktop Nav links */}
        {navLinks()}

        {/* Theme toggle */}
        <div className="mb-2">
          {themeToggleButton}
        </div>

        {/* User + logout */}
        {userProfileCard()}
      </aside>
    </>
  )
}
