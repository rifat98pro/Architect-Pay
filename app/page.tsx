'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Wallet, Globe, Users, Zap, Shield, Code2,
  ChevronRight, Banknote, Building2, CheckCircle2,
  Calendar,
} from 'lucide-react'

function XLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#000', color: '#e2eaf4' }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Architect Pay" width={32} height={32} className="rounded-xl object-contain" />
            <span className="text-lg font-bold tracking-tight">
              <span style={{ color: '#c5d3ed' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex" style={{ color: '#888' }}>
            <a href="#features"  className="transition-colors hover:text-white">Features</a>
            <a href="#developer" className="transition-colors hover:text-white">Developers</a>
            <a href="#use-cases" className="transition-colors hover:text-white">Use Cases</a>
            <Link href="/docs"   className="transition-colors hover:text-white">Docs</Link>
            <a href="#socials"   className="transition-colors hover:text-white">Socials</a>
          </nav>

          <Link
            href="/signup"
            className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
            style={{ background: '#2aabab' }}
          >
            Launch App <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 text-center">

        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(42,171,171,0.08) 0%, transparent 70%)',
        }} />

        <div className="relative z-10 flex flex-col items-center">
          <div
            className="mb-8 select-none text-center font-black uppercase leading-none"
            style={{ letterSpacing: '-0.03em', color: '#2aabab' }}
          >
            {[
              { text: 'GLOBAL PAYROLL',     size: 'clamp(2rem, 5.5vw, 4.5rem)', opacity: 1    },
              { text: 'STABLECOIN PAYMENTS', size: 'clamp(1.4rem, 3.8vw, 3rem)', opacity: 0.45 },
              { text: 'EVERY BUSINESS',      size: 'clamp(1.4rem, 3.8vw, 3rem)', opacity: 0.45 },
            ].map(({ text, size, opacity }) => (
              <div
                key={text}
                style={{
                  fontSize: size,
                  opacity,
                  lineHeight: 1.05,
                  textShadow: opacity === 1 ? '0 0 80px rgba(42,171,171,0.5)' : 'none',
                }}
              >
                {text}
              </div>
            ))}
          </div>

          <p className="mb-8 max-w-xl text-base leading-relaxed" style={{ color: '#666' }}>
            Global payroll and stablecoin payments for businesses. Manage multiple businesses and pay teams across chains from one account. Web2 simplicity.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-black transition-all hover:opacity-90"
              style={{ background: '#2aabab', boxShadow: '0 0 30px rgba(42,171,171,0.35)' }}
            >
              Get Started Free
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium transition-colors hover:text-white"
              style={{ color: '#666' }}
            >
              See how it works →
            </a>
          </div>

          <div className="mt-6">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Testnet only · No real money · Mainnet coming soon
            </span>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <section className="border-y px-6 py-10" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            { value: '7 chains',    label: 'Supported networks'     },
            { value: 'USDC & EURC', label: 'Stablecoins supported'  },
            { value: '0.01%',       label: 'Platform fee'            },
            { value: 'Instant',     label: 'Same-chain transfers'    },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold" style={{ color: '#2aabab' }}>{s.value}</div>
              <div className="mt-0.5 text-xs" style={{ color: '#555' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Everything you need</div>
            <h2 className="text-3xl font-bold text-white">Built for businesses, not crypto experts</h2>
            <p className="mt-3 text-sm" style={{ color: '#555' }}>Everything runs on blockchain. Nothing about it feels like blockchain.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Building2 className="h-5 w-5" />,      title: 'Multi-Business Management', desc: 'Create multiple businesses under one account. Each business has its own employee roster, payroll history, and settings.',  color: '#2aabab' },
              { icon: <Users className="h-5 w-5" />,           title: 'Global Payroll',             desc: 'Add employees, set salaries, run payroll with one click. Pay any wallet on any of 7 supported chains simultaneously.',       color: '#60a5fa' },
              { icon: <Globe className="h-5 w-5" />,           title: 'Stablecoin Payments',        desc: 'Send USDC and EURC to any wallet address globally. Instant on the same chain, ~2–3 min cross-chain via Circle CCTP.',       color: '#a78bfa' },
              { icon: <Calendar className="h-5 w-5" />,        title: 'Scheduled Auto-Payroll',     desc: 'Set a payday date once. Payroll fires automatically every month — even while you sleep.',                                    color: '#34d399' },
              { icon: <Wallet className="h-5 w-5" />,          title: 'No Wallet Setup',            desc: 'Sign up with email and password. Wallets are created and managed for you. No seed phrases, no MetaMask, no gas fees.',       color: '#fb923c' },
              { icon: <Shield className="h-5 w-5" />,          title: 'On-Chain Audit Trail',       desc: 'Every payroll run and payment is logged immutably on-chain. Full history with explorer links — no spreadsheet needed.',      color: '#f472b6' },
            ].map((feat) => (
              <div
                key={feat.title}
                className="rounded-2xl border p-6 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = feat.color + '40'
                  el.style.background  = 'rgba(255,255,255,0.055)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.background  = 'rgba(255,255,255,0.03)'
                }}
              >
                <div className="mb-4 inline-flex rounded-xl p-2.5" style={{ background: feat.color + '15' }}>
                  <span style={{ color: feat.color }}>{feat.icon}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{feat.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Simple setup</div>
            <h2 className="text-3xl font-bold text-white">Up and running in minutes</h2>
            <p className="mt-3 text-sm" style={{ color: '#555' }}>No blockchain knowledge required — if you can use a bank app, you can use Architect Pay.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: '01',
                icon: <Wallet className="h-6 w-6" />,
                title: 'Create your account',
                body: 'Sign up with email and password like any web app. We silently provision multi-chain wallets for you — no seed phrases, no MetaMask required.',
              },
              {
                step: '02',
                icon: <Building2 className="h-6 w-6" />,
                title: 'Add your businesses & teams',
                body: 'Create one or more businesses, add employees with their wallet addresses and salaries. Mix USDC and EURC, different chains — all in one place.',
              },
              {
                step: '03',
                icon: <Banknote className="h-6 w-6" />,
                title: 'Run payroll & send payments',
                body: 'Hit Run Payroll and every employee gets paid to their preferred chain instantly. Or send one-off payments to any address globally.',
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="relative rounded-2xl border p-8"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(42,171,171,0.15)' }}
              >
                {i < 2 && (
                  <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
                    <ChevronRight className="h-5 w-5" style={{ color: 'rgba(42,171,171,0.3)' }} />
                  </div>
                )}
                <div className="absolute right-6 top-6 text-4xl font-black" style={{ color: 'rgba(42,171,171,0.07)' }}>{item.step}</div>
                <div className="mb-4 inline-flex rounded-xl p-3" style={{ background: 'rgba(42,171,171,0.1)' }}>
                  <span style={{ color: '#2aabab' }}>{item.icon}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{item.body}</p>
              </div>
            ))}
          </div>

          {/* Cross-chain flow */}
          <div className="mt-12 rounded-2xl border p-8" style={{ background: 'rgba(42,171,171,0.04)', borderColor: 'rgba(42,171,171,0.15)' }}>
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: '#2aabab' }}>What happens under the hood (Circle CCTP V2)</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: 'Your funds on any chain',   bg: 'rgba(255,255,255,0.05)', color: '#888'    },
                null,
                { label: 'Burn on source chain',      bg: 'rgba(251,191,36,0.08)',  color: '#fbbf24' },
                null,
                { label: 'Circle attestation',        bg: 'rgba(96,165,250,0.08)',  color: '#60a5fa' },
                null,
                { label: 'Mint on destination chain', bg: 'rgba(52,211,153,0.08)',  color: '#34d399' },
                null,
                { label: 'Employee receives payment', bg: 'rgba(42,171,171,0.12)',  color: '#2aabab' },
              ].map((item, i) =>
                item === null
                  ? <ChevronRight key={i} className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  : <span key={i} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: item.bg, color: item.color }}>{item.label}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Use Cases ──────────────────────────────────────────────────────── */}
      <section id="use-cases" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Use cases</div>
            <h2 className="text-3xl font-bold text-white">Who uses Architect Pay?</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              {
                icon: <Users className="h-5 w-5" />,
                title: 'Remote-First Companies',
                body: 'Pay distributed teams across any country and chain in USDC or EURC. No FX fees, no bank delays, no paperwork.',
                bullets: ['Employees choose their preferred chain', 'Payroll runs automatically each month', 'Full payment history on-chain'],
                color: '#2aabab',
              },
              {
                icon: <Building2 className="h-5 w-5" />,
                title: 'Multi-Business Owners',
                body: 'Manage multiple companies from a single Architect Pay account. Separate employees, payroll runs, and histories per business.',
                bullets: ['Unlimited businesses under one login', 'Each business is fully isolated', 'Switch between businesses in one click'],
                color: '#60a5fa',
              },
              {
                icon: <Globe className="h-5 w-5" />,
                title: 'Vendor & Contractor Payments',
                body: "Pay freelancers and suppliers globally without asking what chain they're on. Any EVM address receives USDC or EURC.",
                bullets: ['One-off payments to any wallet', 'Wallet address + label tracking', 'Explorer links for every transaction'],
                color: '#a78bfa',
              },
              {
                icon: <Zap className="h-5 w-5" />,
                title: 'Crypto-Native Startups',
                body: 'Replace your manual stablecoin payroll spreadsheets with a proper system. Audit-ready, automated, multi-chain.',
                bullets: ['Replace manual wallet sends', 'On-chain proof of every payment', 'No gas management or RPC setup'],
                color: '#34d399',
              },
            ].map((uc) => (
              <div
                key={uc.title}
                className="rounded-2xl border p-8 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div className="mb-4 inline-flex rounded-xl p-3" style={{ background: uc.color + '15' }}>
                  <span style={{ color: uc.color }}>{uc.icon}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{uc.title}</h3>
                <p className="mb-4 text-sm leading-relaxed" style={{ color: '#666' }}>{uc.body}</p>
                <ul className="space-y-2">
                  {uc.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm" style={{ color: '#888' }}>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: uc.color }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developer Portal ───────────────────────────────────────────────── */}
      <section id="developer" className="px-6 py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Open stack</div>
            <h2 className="text-3xl font-bold text-white">Developer Portal</h2>
            <p className="mt-3 text-sm" style={{ color: '#555' }}>The tech powering Architect Pay — all open, all auditable.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border p-8" style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(42,171,171,0.15)' }}>
              <div className="mb-6 flex items-center gap-3">
                <Code2 className="h-5 w-5" style={{ color: '#2aabab' }} />
                <h3 className="font-semibold text-white">API Routes</h3>
              </div>
              <ul className="space-y-2 font-mono text-xs" style={{ color: '#555' }}>
                {[
                  ['POST', '/api/auth/register'],
                  ['GET',  '/api/wallet/balance'],
                  ['POST', '/api/payments/send'],
                  ['POST', '/api/payroll/run'],
                  ['GET',  '/api/payroll/runs'],
                  ['POST', '/api/swap'],
                  ['GET',  '/api/swap/history'],
                  ['POST', '/api/employees'],
                  ['GET',  '/api/payments/history'],
                ].map(([method, route]) => (
                  <li key={`${method}-${route}`} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold" style={{
                      background: method === 'GET' ? 'rgba(52,211,153,0.1)' : method === 'POST' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)',
                      color:      method === 'GET' ? '#34d399'              : method === 'POST' ? '#60a5fa'               : '#f87171',
                    }}>{method}</span>
                    <span>{route}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border p-6" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="mb-4 flex items-center gap-3">
                  <Shield className="h-5 w-5" style={{ color: '#2aabab' }} />
                  <h3 className="font-semibold text-white">Tech Stack</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: '#666' }}>
                  {[
                    'Next.js 14 App Router + TypeScript',
                    'Circle Developer-Controlled Wallets SDK',
                    'CCTP V2 (viem encodeFunctionData)',
                    'Prisma + Neon PostgreSQL',
                    'NextAuth.js sessions',
                    'Tailwind CSS',
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#2aabab' }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: 'Circle CCTP V2',  href: 'https://developers.circle.com/stablecoins/cctp-getting-started', tag: 'Docs'     },
                  { title: 'Arc Testnet',     href: 'https://developers.circle.com/arc',                              tag: 'Docs'     },
                  { title: 'ArcScan',         href: 'https://testnet.arcscan.app',                                    tag: 'Explorer' },
                  { title: 'Circle Faucet',   href: 'https://faucet.circle.com',                                      tag: 'Faucet'   },
                ].map((doc) => (
                  <a
                    key={doc.title}
                    href={doc.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border p-4 transition-all block"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,171,171,0.3)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
                  >
                    <div className="mb-1 text-xs font-medium" style={{ color: '#2aabab' }}>{doc.tag}</div>
                    <div className="text-sm font-medium text-white">{doc.title}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Socials ────────────────────────────────────────────────────────── */}
      <section id="socials" className="px-6 py-20 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Community</div>
          <h2 className="mb-3 text-3xl font-bold text-white">Stay connected</h2>
          <p className="mb-10 text-sm" style={{ color: '#555' }}>Follow our journey, get updates, and join the community.</p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              {
                icon: <XLogo size={20} />,
                label: 'Twitter / X',
                handle: '@architectpay',
                href: 'https://x.com/architectpay',
                color: '#e2e8f0',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
                  </svg>
                ),
                label: 'Discord',
                handle: 'Join our server',
                href: 'https://discord.gg/e3uZqjpRCp',
                color: '#5865F2',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                ),
                label: 'Telegram',
                handle: 'Join our channel',
                href: 'https://t.me/+BvMz_xlHRjgwZjg1',
                color: '#29b6f6',
              },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border px-6 py-4 transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = s.color + '50'
                  el.style.background  = s.color + '10'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.background  = 'rgba(255,255,255,0.03)'
                }}
              >
                <span style={{ color: s.color }}>{s.icon}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">{s.label}</div>
                  <div className="text-xs" style={{ color: '#555' }}>{s.handle}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-32 text-center">
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(42,171,171,0.06) 0%, transparent 70%)',
        }} />
        <div className="relative z-10 mx-auto max-w-xl">
          <h2 className="mb-4 text-4xl font-bold text-white">
            One account.
            <br />
            <span style={{ color: '#2aabab' }}>Every business. Every team.</span>
          </h2>
          <p className="mb-8 text-sm leading-relaxed" style={{ color: '#555' }}>
            Global payroll and stablecoin payments — set up in minutes, no crypto knowledge needed.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-black transition-all hover:opacity-90"
            style={{ background: '#2aabab', boxShadow: '0 0 40px rgba(42,171,171,0.3)' }}
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-8 text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#444' }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Architect Pay" width={18} height={18} className="rounded-md object-contain opacity-50" />
            <span>Architect Pay · Global payroll & stablecoin payments · Powered by Circle CCTP V2</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/terms"   className="transition-colors hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <a href="https://x.com/architectpay" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Twitter</a>
            <p className="hidden sm:block">All transactions use testnet USDC — no real money involved.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
