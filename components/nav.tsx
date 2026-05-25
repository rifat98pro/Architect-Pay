'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { LayoutDashboard, Send, History, Users, Banknote, LogOut, ArrowLeftRight, Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/payments',  label: 'Send Payment', icon: Send },
  { href: '/employees', label: 'Employees',    icon: Users },
  { href: '/payroll',   label: 'Payroll',      icon: Banknote },
  { href: '/swap',      label: 'Swap',         icon: ArrowLeftRight },
  { href: '/bridge',    label: 'Bridge',       icon: Shuffle },
  { href: '/history',   label: 'History',      icon: History },
]

export default function Nav() {
  const pathname    = usePathname()
  const { logout, user } = useAuth()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white px-3 py-6">
      <div className="mb-8 px-3">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Architect Pay" width={32} height={32} className="rounded-lg object-contain" />
          <span className="text-base font-bold text-brand-600">Architect Pay</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">Arc Testnet</div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              pathname === href
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-100 pt-4">
        {user && (
          <div className="mb-3 px-3">
            <div className="text-sm font-medium text-gray-900 truncate">{user.name ?? user.email}</div>
            <div className="text-xs text-gray-400 truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
