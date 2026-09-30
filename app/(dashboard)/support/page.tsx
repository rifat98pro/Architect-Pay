'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import {
  LifeBuoy, Search, ChevronDown, ChevronRight,
  Wallet, Globe, Banknote, Shield, Zap, MessageSquare,
  CheckCircle2, ExternalLink, AlertCircle, Clock,
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
    a: 'Click the Deposit button on your Dashboard. A QR code and your wallet address will appear. Send USDC or EURC from any exchange or wallet — it works on Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Polygon Amoy.',
  },
  {
    id: 'getting-started',
    q: 'Do I need MetaMask or a seed phrase?',
    a: 'No. Architect Pay uses Circle Developer-Controlled Wallets — your wallet is provisioned automatically when you sign up. Gas fees are sponsored by Circle Gas Station so you never need to hold ETH.',
  },
  {
    id: 'payments',
    q: 'How long do cross-chain transfers take?',
    a: 'Cross-chain transfers via Circle CCTP V2 typically settle in 2–3 minutes. Arc Testnet → Arc Testnet payments are instant with zero fee.',
  },
  {
    id: 'payments',
    q: 'What is the platform fee?',
    a: 'Architect Pay charges a 0.1% fee on cross-chain payments, cross-chain swaps, and payroll runs. Same-chain transfers are always free.',
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

  // ticket form
  const [subject,      setSubject]      = useState('')
  const [category,     setCategory]     = useState('general')
  const [message,      setMessage]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const filteredFaqs = FAQS.filter((f) => {
    const matchSearch   = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !activeCategory || f.id === activeCategory
    return matchSearch && matchCategory
  })

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || !subject.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category: `support:${category}`, message: `[${subject}]\n\n${message}` }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
      setSubject('')
      setCategory('general')
      setMessage('')
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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

      {/* Submit ticket */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/60">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <MessageSquare className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-white">Still need help? Contact us</span>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <p className="font-semibold text-white">Ticket submitted!</p>
            <p className="text-sm text-gray-500">We&apos;ll get back to you as soon as possible.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-2 text-sm text-brand-400 hover:underline"
            >
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={submitTicket} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border bg-gray-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500/50"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <option value="general">General</option>
                  <option value="payments">Payments & Transfers</option>
                  <option value="payroll">Payroll</option>
                  <option value="account">Account & Security</option>
                  <option value="bug">Bug Report</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Subject</label>
                <input
                  type="text"
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full rounded-xl border bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-brand-500/50"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Message</label>
              <textarea
                placeholder="Describe your issue in detail…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full resize-none rounded-xl border bg-gray-800/60 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition focus:border-brand-500/50"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Clock className="h-3.5 w-3.5" />
                Typical response time: a few hours
              </div>
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !message.trim()}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #2aabab, #1a7070)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 animate-pulse" /> Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5" /> Submit Ticket
                  </span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Circle CCTP Docs',  href: 'https://developers.circle.com/stablecoins/cctp-getting-started', icon: <ExternalLink className="h-3.5 w-3.5" /> },
          { label: 'Arc Testnet',       href: 'https://developers.circle.com/arc',                              icon: <ExternalLink className="h-3.5 w-3.5" /> },
          { label: 'ArcScan Explorer',  href: 'https://testnet.arcscan.app',                                    icon: <ExternalLink className="h-3.5 w-3.5" /> },
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
