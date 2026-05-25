import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Wallet, Globe, Users, Zap, Shield, Code2,
  ChevronRight, Banknote, Building2, RefreshCw, CheckCircle2,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Architect Pay" width={36} height={36} className="object-contain rounded-lg" />
            <span className="text-xl font-bold text-brand-600">Architect Pay</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How It Works</a>
            <a href="#use-cases"    className="hover:text-brand-600 transition-colors">Use Cases</a>
            <a href="#documentation" className="hover:text-brand-600 transition-colors">Documentation</a>
            <a href="#developer"    className="hover:text-brand-600 transition-colors">Developer Portal</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login"  className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 px-6 py-28 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-100">
            Powered by Circle CCTP V2 · Arc Testnet
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight">
            Pay employees globally
            <br />
            <span className="text-brand-200">with one USDC balance.</span>
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-lg text-brand-100">
            Architect Pay lets you run payroll, send cross-chain USDC payments, and manage employees from a single dashboard

          </p>
          <div className="mb-8">
            <span className="inline-block rounded-full bg-yellow-400/20 border border-yellow-400/40 px-4 py-1.5 text-sm font-medium text-yellow-200">
              🧪 Currently live on testnet only
            </span>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup" className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-colors">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-base font-medium text-white hover:bg-white/10 transition-colors">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 text-center sm:grid-cols-4">
          {[
            { value: '5 chains',    label: 'Supported networks'    },
            { value: '~2–3 min',   label: 'Cross-chain settlement' },
            { value: '~1% fee',    label: 'CCTP relayer cost'      },
            { value: 'Instant',    label: 'Arc → Arc transfers'    },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-brand-600">{s.value}</div>
              <div className="mt-0.5 text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="mt-3 text-gray-500">Three steps from sign-up to sending payroll.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                icon: <Wallet className="h-7 w-7 text-brand-600" />,
                title: 'Create your account',
                body: 'Sign up in seconds. We instantly provision a developer-controlled SCA wallet on Arc Testnet and every supported source chain — no seed phrases, no MetaMask required.',
              },
              {
                step: '02',
                icon: <Globe className="h-7 w-7 text-brand-600" />,
                title: 'Fund from any chain',
                body: 'Deposit USDC from Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, or Polygon Amoy. Circle CCTP V2 burns it on the source chain and mints it directly to your Arc wallet in ~2–3 minutes.',
              },
              {
                step: '03',
                icon: <Banknote className="h-7 w-7 text-brand-600" />,
                title: 'Run payroll or send payments',
                body: 'Add employees with wallet addresses and salaries, then hit Run Payroll. Or send one-off payments to any Arc Testnet address instantly. All transactions are on-chain and auditable.',
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div className="absolute right-6 top-6 text-4xl font-black text-gray-50">{item.step}</div>
                <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-3">{item.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{item.body}</p>
              </div>
            ))}
          </div>

          {/* CCTP flow diagram */}
          <div className="mt-14 rounded-2xl bg-gradient-to-r from-brand-50 to-blue-50 p-8">
            <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-brand-700">CCTP V2 Cross-Chain Flow</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: 'Your ETH/Base/ARB/Polygon wallet', color: 'bg-gray-100 text-gray-700' },
                null,
                { label: 'approve + depositForBurn', color: 'bg-amber-100 text-amber-800' },
                null,
                { label: 'Iris API attestation', color: 'bg-blue-100 text-blue-800' },
                null,
                { label: 'receiveMessage on Arc', color: 'bg-green-100 text-green-800' },
                null,
                { label: 'USDC in Arc wallet ✓', color: 'bg-brand-100 text-brand-800' },
              ].map((item, i) =>
                item === null
                  ? <ChevronRight key={i} className="h-4 w-4 text-gray-400" />
                  : <span key={i} className={`rounded-lg px-3 py-1.5 font-medium ${item.color}`}>{item.label}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Use Cases ──────────────────────────────────────────────────────── */}
      <section id="use-cases" className="bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold">Use Cases</h2>
            <p className="mt-3 text-gray-500">Who benefits from Architect Pay?</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: <Users className="h-6 w-6 text-brand-600" />,
                title: 'Global Payroll',
                body: 'Pay remote employees and contractors in USDC regardless of which chain their wallet is on. Run payroll for your whole team in one click — funds arrive in seconds on Arc Testnet.',
                bullets: ['Add employee roster with salaries', 'One-click batch payroll', 'Per-employee tx history'],
              },
              {
                icon: <Building2 className="h-6 w-6 text-brand-600" />,
                title: 'Vendor Payments',
                body: 'Pay vendors and suppliers on-chain without asking them to set up a specific chain. Any EVM address on Arc Testnet receives USDC instantly.',
                bullets: ['Instant on-chain payments', 'Wallet address + label tracking', 'Payment history with explorer links'],
              },
              {
                icon: <RefreshCw className="h-6 w-6 text-brand-600" />,
                title: 'Cross-Chain Treasury',
                body: 'Aggregate USDC scattered across multiple chains into a single spendable Arc Testnet balance. No manual bridging, no gas management per chain.',
                bullets: ['Auto-aggregate from all chains', 'Parallel CCTP pulls', 'Arc becomes unified treasury'],
              },
              {
                icon: <Zap className="h-6 w-6 text-brand-600" />,
                title: 'Instant Settlements',
                body: 'Arc Testnet → Arc Testnet transfers are instant with zero fee. Perfect for internal transfers between team wallets or settling invoices in real time.',
                bullets: ['Zero fee on-Arc transfers', 'Circle Gas Station sponsors gas', 'No MetaMask or seed phrases'],
              },
            ].map((uc) => (
              <div key={uc.title} className="rounded-2xl border border-gray-200 bg-white p-8">
                <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-3">{uc.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{uc.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-500">{uc.body}</p>
                <ul className="space-y-1.5">
                  {uc.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Documentation ──────────────────────────────────────────────────── */}
      <section id="documentation" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold">Documentation</h2>
            <p className="mt-3 text-gray-500">Everything you need to understand the stack.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Circle CCTP V2',
                desc: 'Cross-Chain Transfer Protocol — how USDC burns and mints across EVM chains.',
                href: 'https://developers.circle.com/stablecoins/cctp-getting-started',
                tag: 'External docs',
              },
              {
                title: 'Arc Testnet',
                desc: 'Circle\'s L2 blockchain built on Arbitrum Orbit. Fast, cheap, USDC-native.',
                href: 'https://developers.circle.com/arc',
                tag: 'External docs',
              },
              {
                title: 'Developer-Controlled Wallets',
                desc: 'Circle SDK for provisioning and operating SCA wallets on behalf of users.',
                href: 'https://developers.circle.com/w3s/developer-controlled-wallets',
                tag: 'External docs',
              },
              {
                title: 'Iris API',
                desc: 'Circle\'s attestation service — polls until a burn message is ready to relay on Arc.',
                href: 'https://iris-api-sandbox.circle.com',
                tag: 'Sandbox API',
              },
              {
                title: 'Circle Faucet',
                desc: 'Get free testnet USDC on Ethereum Sepolia, Base Sepolia, and other chains.',
                href: 'https://faucet.circle.com',
                tag: 'Testnet tool',
              },
              {
                title: 'ArcScan Explorer',
                desc: 'Browse Arc Testnet transactions, addresses, and smart contract calls.',
                href: 'https://testnet.arcscan.app',
                tag: 'Block explorer',
              },
            ].map((doc) => (
              <a
                key={doc.title}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="mb-1 text-xs font-medium text-brand-500">{doc.tag}</div>
                <h3 className="mb-1.5 font-semibold group-hover:text-brand-600 transition-colors">{doc.title}</h3>
                <p className="text-sm text-gray-500">{doc.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developer Portal ───────────────────────────────────────────────── */}
      <section id="developer" className="bg-gray-900 px-6 py-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold">Developer Portal</h2>
            <p className="mt-3 text-gray-400">The tech stack powering Architect Pay.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-800 p-8">
              <Code2 className="mb-4 h-7 w-7 text-brand-400" />
              <h3 className="mb-3 text-lg font-semibold">API Routes</h3>
              <ul className="space-y-2 font-mono text-sm text-gray-400">
                {[
                  ['POST', '/api/auth/register'],
                  ['POST', '/api/auth/login'],
                  ['GET',  '/api/wallet/balance'],
                  ['POST', '/api/wallet/deposit'],
                  ['POST', '/api/payments/send'],
                  ['POST', '/api/payments/aggregate-send'],
                  ['GET',  '/api/payments/aggregate-plan'],
                  ['GET',  '/api/payments/history'],
                  ['GET',  '/api/employees'],
                  ['POST', '/api/employees'],
                  ['DELETE', '/api/employees/[id]'],
                  ['POST', '/api/payroll/run'],
                  ['GET',  '/api/payroll/runs'],
                ].map(([method, route]) => (
                  <li key={route} className="flex items-center gap-3">
                    <span className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold ${
                      method === 'GET' ? 'bg-green-900 text-green-400' :
                      method === 'POST' ? 'bg-blue-900 text-blue-400' :
                      'bg-red-900 text-red-400'
                    }`}>{method}</span>
                    <span>{route}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-gray-800 p-6">
                <Shield className="mb-3 h-6 w-6 text-brand-400" />
                <h3 className="mb-2 font-semibold">Tech Stack</h3>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  {[
                    'Next.js 14 App Router',
                    'Circle Developer-Controlled Wallets SDK',
                    'CCTP V2 (viem encodeFunctionData)',
                    'Prisma + SQLite',
                    'JWT session cookies',
                    'Tailwind CSS',
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-gray-800 p-6">
                <Zap className="mb-3 h-6 w-6 text-brand-400" />
                <h3 className="mb-2 font-semibold">Key Integrations</h3>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  {[
                    'Circle Iris API — CCTP attestation polling',
                    'Circle Gas Station — fee sponsorship',
                    'Arc Testnet CCTP domain 26',
                    'ArcScan — transaction explorer links',
                    'Circle Testnet Faucet — USDC funding',
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-brand-600 to-brand-800 px-6 py-20 text-center text-white">
        <h2 className="mb-4 text-3xl font-bold">Ready to run payroll on-chain?</h2>
        <p className="mb-8 text-brand-100">Set up your account in under a minute. No wallet required.</p>
        <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-colors">
          Get started free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white px-6 py-8 text-center text-xs text-gray-400">
        <p>Architect Pay · Built on Arc Testnet · Powered by Circle CCTP V2</p>
        <p className="mt-1">All transactions use testnet USDC — no real money involved.</p>
      </footer>

    </div>
  )
}
