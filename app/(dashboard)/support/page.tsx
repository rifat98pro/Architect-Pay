'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import {
  LifeBuoy, Search, ChevronDown,
  Wallet, Globe, Banknote, Shield,
  ExternalLink, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  {
    icon: <Wallet className="h-5 w-5" />,
    title: 'Getting Started',
    desc: 'Account setup, wallet creation, first deposit.',
    color: '#2aabab',
    faqs: ['getting-started'],
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: 'Payments & Transfers',
    desc: 'Sending USDC/EURC, cross-chain transfers, CCTP.',
    color: '#60a5fa',
    faqs: ['payments'],
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: 'Payroll',
    desc: 'Employee management, payroll runs, scheduling.',
    color: '#34d399',
    faqs: ['payroll'],
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Account & Security',
    desc: 'Profile, sessions, wallet access, password.',
    color: '#f472b6',
    faqs: ['account'],
  },
]

const FAQS = [
  {
    id: 'getting-started',
    q: 'How do I fund my wallet?',
    a: 'Click the Deposit button on your Dashboard. A QR code and your wallet address will appear. Send USDC or EURC from any exchange or wallet — it works on Arc, Ethereum, Base, Arbitrum, Polygon, Avalanche, and Optimism.',
  },
  {
    id: 'getting-started',
    q: 'Do I need MetaMask or a seed phrase?',
    a: 'No. Architect Pay uses Circle Developer-Controlled Wallets — your wallet is provisioned automatically when you sign up. Gas fees are sponsored by Circle Gas Station so you never need to hold ETH.',
  },
  {
    id: 'payments',
    q: 'How long do cross-chain transfers take?',
    a: 'Cross-chain transfers via Circle CCTP typically settle in 2–3 minutes. Arc → Arc payments are instant with zero fee.',
  },
  {
    id: 'payments',
    q: 'What is the platform fee?',
    a: 'Architect Pay charges a 0.01% platform fee on cross-chain payments, cross-chain swaps, and payroll runs. Same-chain transfers are always free with no platform fee.',
  },
  {
    id: 'payments',
    q: 'Can I send EURC?',
    a: 'Yes — you can send EURC cross-chain and swap between EURC and USDC from the Swap page. EURC is fully supported alongside USDC.',
  },
  {
    id: 'payroll',
    q: 'How do I schedule automatic payroll?',
    a: 'Go to the Payroll page, select a business, and pick a payday (1–28) from the schedule grid. Hit Save Schedule — payroll will automatically run on that day every month at midnight UTC.',
  },
  {
    id: 'payroll',
    q: 'What happens if payroll fails for one employee?',
    a: 'Architect Pay processes employees in parallel. If one payment fails the others still complete — the run status shows as "Partial" and you can see the error per employee in History.',
  },
  {
    id: 'account',
    q: 'How do I change my profile picture?',
    a: 'Go to Settings → Profile Photo. Click "Upload Photo", choose an image, and it uploads automatically. Your photo appears in the sidebar and across the app.',
  },
  {
    id: 'account',
    q: 'Is this live on mainnet?',
    a: 'Not yet — Architect Pay is currently running on testnet only. All USDC/EURC is test tokens with no real monetary value. Mainnet launch is coming soon.',
  },
]

export default function SupportPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [search,       setSearch]       = useState('')
  const [openFaq,      setOpenFaq]      = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const filteredFaqs = FAQS.filter((f) => {
    const matchSearch   = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !activeCategory || f.id === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Support Center</h1>
        <p className="mt-0.5 text-sm text-gray-500">Find answers or contact our team.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search for answers…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveCategory(null) }}
          className="w-full rounded-xl border bg-gray-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-gray-600 outline-none transition focus:border-brand-500/50"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.faqs[0]
          return (
            <button
              key={cat.title}
              onClick={() => { setActiveCategory(active ? null : cat.faqs[0]); setSearch('') }}
              className="rounded-xl border p-4 text-left transition-all"
              style={{
                background:   active ? cat.color + '15' : 'rgba(255,255,255,0.03)',
                borderColor:  active ? cat.color + '60' : 'rgba(255,255,255,0.07)',
              }}
            >
              <div className="mb-2.5 inline-flex rounded-lg p-2" style={{ background: cat.color + '15' }}>
                <span style={{ color: cat.color }}>{cat.icon}</span>
              </div>
              <div className="text-xs font-semibold text-white">{cat.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-gray-500">{cat.desc}</div>
            </button>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">
              {activeCategory
                ? CATEGORIES.find((c) => c.faqs[0] === activeCategory)?.title
                : search ? `Results for "${search}"` : 'Frequently Asked Questions'}
            </span>
          </div>
          {(activeCategory || search) && (
            <button
              onClick={() => { setActiveCategory(null); setSearch('') }}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No results found. Try a different search or submit a ticket below.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filteredFaqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-800/30"
                  >
                    <span className="text-sm font-medium text-white">{faq.q}</span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-800/60 bg-gray-800/20 px-5 py-4">
                      <p className="text-sm leading-relaxed text-gray-400">{faq.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Still need help */}
      <a
        href="https://discord.gg/e3uZqjpRCp"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-2xl border border-gray-700/50 bg-gray-900/60 px-6 py-5 transition hover:border-[#5865F2]/40 hover:bg-[#5865F2]/5 group"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(88,101,242,0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Still need help? Join our Discord</p>
            <p className="text-xs text-gray-500 mt-0.5">Get support from the Architect Pay community and team.</p>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-600 group-hover:text-[#5865F2] transition-colors shrink-0" />
      </a>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Circle CCTP Docs',  href: 'https://developers.circle.com/stablecoins/cctp-getting-started', icon: <ExternalLink className="h-3.5 w-3.5" /> },
          { label: 'Arc Docs',          href: 'https://developers.circle.com/arc',                              icon: <ExternalLink className="h-3.5 w-3.5" /> },
          { label: 'ArcScan Explorer',  href: 'https://arbiscan.io',                                            icon: <ExternalLink className="h-3.5 w-3.5" /> },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium text-gray-400 transition hover:border-brand-500/30 hover:text-white"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
          >
            {link.label}
            {link.icon}
          </a>
        ))}
      </div>

    </div>
  )
}
