import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2, Code2, Shield, Zap, Globe, Users, ArrowRight } from 'lucide-react'

const SECTIONS = [
  { id: 'overview',       label: 'Overview'         },
  { id: 'quickstart',     label: 'Quick Start'      },
  { id: 'payments',       label: 'Payments API'     },
  { id: 'payroll',        label: 'Payroll'          },
  { id: 'cross-chain',    label: 'Cross-Chain CCTP' },
  { id: 'swaps',          label: 'Swaps'            },
  { id: 'api-reference',  label: 'API Reference'    },
  { id: 'faq',            label: 'FAQ'              },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="mb-6 text-2xl font-bold text-white">{title}</h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border p-5 text-sm font-mono leading-relaxed"
      style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.08)', color: '#a3e635' }}>
      {children}
    </pre>
  )
}

function Badge({ children, color = '#2aabab' }: { children: string; color?: string }) {
  return (
    <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: color + '18', color }}>
      {children}
    </span>
  )
}

function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === 'GET' ? '#34d399' : method === 'POST' ? '#60a5fa' : '#f87171'
  return (
    <div className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:items-start sm:gap-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <Badge color={color}>{method}</Badge>
      <code className="text-sm font-mono" style={{ color: '#c5d3ed' }}>{path}</code>
      <span className="text-sm" style={{ color: '#666' }}>{desc}</span>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#000', color: '#c5d3ed' }}>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.9)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-sm transition-colors hover:text-white" style={{ color: '#555' }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Architect Pay" width={24} height={24} className="rounded-lg object-contain" />
              <span className="text-sm font-bold">
                <span style={{ color: '#c5d3ed' }}>Architect</span>
                <span style={{ color: '#2aabab' }}> Pay</span>
                <span className="ml-2 text-xs font-normal" style={{ color: '#444' }}>Docs</span>
              </span>
            </div>
          </div>
          <Link href="/signup" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-black" style={{ background: '#2aabab' }}>
            Launch App <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-12 px-6 py-12">

        {/* Sidebar */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Contents</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-2 text-sm transition-colors hover:text-white"
                style={{ color: '#555' }}
              >
                {s.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">

          <div className="mb-12">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Documentation</div>
            <h1 className="mb-4 text-4xl font-black text-white">Architect Pay Docs</h1>
            <p className="text-lg leading-relaxed" style={{ color: '#666' }}>
              Everything you need to understand and integrate Architect Pay — from sending your first payment to running automated cross-chain payroll.
            </p>
          </div>

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="mb-6 leading-relaxed" style={{ color: '#888' }}>
              Architect Pay is an on-chain payroll and payments platform built on the Arc blockchain. It uses Circle's
              Developer-Controlled Wallets (SCA — ERC-4337 Smart Contract Accounts) so users never manage seed phrases,
              and Circle's Gas Station sponsors all transaction fees.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: <Zap className="h-5 w-5" />,   title: 'Instant payments',    desc: 'Arc → Arc transfers settle immediately with no fees.',          color: '#2aabab' },
                { icon: <Globe className="h-5 w-5" />,  title: 'Cross-chain CCTP',   desc: 'Send USDC & EURC across all supported chains via Circle CCTP.',            color: '#60a5fa' },
                { icon: <Users className="h-5 w-5" />,  title: 'Automated payroll',   desc: 'Schedule monthly payroll runs for any number of employees.',   color: '#a78bfa' },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="mb-3" style={{ color: f.color }}>{f.icon}</div>
                  <div className="mb-1 font-semibold text-white">{f.title}</div>
                  <p className="text-sm" style={{ color: '#666' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Quick Start */}
          <Section id="quickstart" title="Quick Start">
            <ol className="space-y-6">
              {[
                {
                  n: 1,
                  title: 'Create an account',
                  body: 'Sign up at architect-pay.vercel.app/signup. A Circle SCA wallet is provisioned instantly on Arc and all supported chains.',
                },
                {
                  n: 2,
                  title: 'Fund your wallet',
                  body: 'Go to your Dashboard and click Deposit. Send USDC or EURC from any exchange or wallet on Arc, Ethereum, Base, Arbitrum, Polygon, Avalanche, or Optimism.',
                },
                {
                  n: 3,
                  title: 'Send a payment',
                  body: 'Go to Send Payment, enter a recipient address, choose your chain and token, and confirm. Same-chain transfers are instant; cross-chain takes 2–30 min depending on network.',
                },
                {
                  n: 4,
                  title: 'Run payroll',
                  body: 'Add employees under the Payroll tab with their wallet address and salary. Click Run Payroll — the platform batches all payments in parallel.',
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black" style={{ background: '#2aabab' }}>
                    {step.n}
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-white">{step.title}</div>
                    <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* Payments */}
          <Section id="payments" title="Payments API">
            <p className="mb-6 text-sm leading-relaxed" style={{ color: '#888' }}>
              Send USDC or EURC to any EVM address on any supported chain. Same-chain payments use Circle&apos;s transfer API directly. Cross-chain payments use Circle CCTP.
            </p>
            <CodeBlock>{`POST /api/payments/send

{
  "recipientAddress": "0xABC...",
  "amount": "10.00",
  "sourceChain": "ARC-TESTNET",
  "destChain": "ETH-SEPOLIA",
  "token": "USDC",
  "label": "Invoice #42"
}

// Response (cross-chain)
{
  "success": true,
  "paymentId": "clx...",
  "pending": true         // poll /api/payments/{id}/mint
}

// Response (same-chain)
{
  "success": true,
  "paymentId": "clx..."
}`}</CodeBlock>
            <p className="mt-4 text-sm" style={{ color: '#888' }}>
              For cross-chain transfers, poll <code className="text-xs" style={{ color: '#2aabab' }}>POST /api/payments/{'{id}'}/mint</code> every 10s until status is <code className="text-xs" style={{ color: '#34d399' }}>COMPLETED</code>.
            </p>
          </Section>

          {/* Payroll */}
          <Section id="payroll" title="Payroll">
            <p className="mb-6 text-sm leading-relaxed" style={{ color: '#888' }}>
              Add employees once and run payroll at any time. You can also schedule automatic monthly runs.
            </p>
            <div className="space-y-4">
              <CodeBlock>{`// Add an employee
POST /api/employees
{
  "name": "Alice Smith",
  "walletAddress": "0xABC...",
  "salary": "3000.00"
}

// Run payroll immediately
POST /api/payroll/run

// Get payroll history
GET /api/payroll/runs`}</CodeBlock>
              <div className="rounded-xl border p-5" style={{ background: 'rgba(42,171,171,0.04)', borderColor: 'rgba(42,171,171,0.15)' }}>
                <p className="text-sm font-semibold text-white mb-2">Scheduled Payroll</p>
                <p className="text-sm" style={{ color: '#888' }}>
                  Set a payday (1–28) in your business settings. A server job runs at midnight UTC on that day each month and executes payroll automatically.
                </p>
              </div>
            </div>
          </Section>

          {/* Cross-Chain */}
          <Section id="cross-chain" title="Cross-Chain CCTP">
            <p className="mb-6 text-sm leading-relaxed" style={{ color: '#888' }}>
              Cross-chain transfers use Circle&apos;s Cross-Chain Transfer Protocol V2. The flow has two phases: burn on source chain, mint on destination chain.
            </p>
            <div className="mb-6 space-y-3">
              {[
                { step: '1', title: 'Approve', desc: 'Token allowance set for TokenMessengerV2 contract. Must confirm on-chain before burn.' },
                { step: '2', title: 'Burn',    desc: 'depositForBurn called on source chain. Returns immediately — Circle transaction ID stored.' },
                { step: '3', title: 'Attest',  desc: 'Iris API monitors the burn and issues a cryptographic attestation. Testnet: 20–30 min. Mainnet: 2–5 min.' },
                { step: '4', title: 'Mint',    desc: 'receiveMessage called on destination chain with the attestation. USDC/EURC appears in recipient wallet.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-4 rounded-xl border p-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style={{ background: '#2aabab' }}>{s.step}</div>
                  <div>
                    <div className="mb-0.5 font-semibold text-white text-sm">{s.title}</div>
                    <p className="text-sm" style={{ color: '#888' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border p-5" style={{ background: 'rgba(251,191,36,0.04)', borderColor: 'rgba(251,191,36,0.15)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#fbbf24' }}>Supported Chains</p>
              <p className="text-sm" style={{ color: '#888' }}>Arc · Ethereum · Base · Arbitrum · Polygon · Avalanche · Optimism</p>
              <p className="text-sm mt-1" style={{ color: '#888' }}>EURC is supported on Arc, Ethereum, and Base only.</p>
            </div>
          </Section>

          {/* Swaps */}
          <Section id="swaps" title="Swaps">
            <p className="mb-6 text-sm leading-relaxed" style={{ color: '#888' }}>
              Swap USDC ↔ EURC on the same chain or cross-chain via the unified swap interface.
            </p>
            <CodeBlock>{`POST /api/swap

{
  "tokenIn": "USDC",
  "tokenOut": "EURC",
  "amountIn": "100.00",
  "srcChain": "ARC-TESTNET",
  "destChain": "ETH-SEPOLIA"
}

GET /api/swap/history`}</CodeBlock>
          </Section>

          {/* API Reference */}
          <Section id="api-reference" title="API Reference">
            <p className="mb-6 text-sm" style={{ color: '#888' }}>All endpoints require a valid session cookie (obtained via <code className="text-xs" style={{ color: '#2aabab' }}>POST /api/auth/login</code>).</p>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', color: '#555' }}>
                Auth
              </div>
              <div className="px-5">
                <ApiRow method="POST" path="/api/auth/register" desc="Create a new account and provision wallets" />
                <ApiRow method="POST" path="/api/auth/login"    desc="Sign in and receive session token" />
                <ApiRow method="GET"  path="/api/auth/me"       desc="Get current authenticated user" />
              </div>
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', color: '#555' }}>
                Wallet
              </div>
              <div className="px-5">
                <ApiRow method="GET"  path="/api/wallet/balance"  desc="Get USDC & EURC balances across all chains" />
                <ApiRow method="GET"  path="/api/wallet/address"  desc="Get wallet address for any supported chain" />
              </div>
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', color: '#555' }}>
                Payments
              </div>
              <div className="px-5">
                <ApiRow method="POST" path="/api/payments/send"         desc="Send USDC/EURC same-chain or cross-chain" />
                <ApiRow method="POST" path="/api/payments/{id}/mint"    desc="Poll cross-chain mint status" />
                <ApiRow method="GET"  path="/api/payments/history"      desc="List all sent payments" />
                <ApiRow method="POST" path="/api/payments/aggregate-send" desc="Sweep all chains to one recipient" />
              </div>
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', color: '#555' }}>
                Payroll
              </div>
              <div className="px-5">
                <ApiRow method="GET"  path="/api/employees"   desc="List employees" />
                <ApiRow method="POST" path="/api/employees"   desc="Add employee" />
                <ApiRow method="POST" path="/api/payroll/run" desc="Execute payroll for all employees" />
                <ApiRow method="GET"  path="/api/payroll/runs" desc="List all payroll runs with entries" />
              </div>
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', color: '#555' }}>
                Swaps
              </div>
              <div className="px-5">
                <ApiRow method="POST" path="/api/swap"         desc="Swap between USDC and EURC" />
                <ApiRow method="GET"  path="/api/swap/history" desc="List all swap records" />
              </div>
            </div>
          </Section>

          {/* FAQ */}
          <Section id="faq" title="FAQ">
            <div className="space-y-4">
              {[
                {
                  q: 'Is this on mainnet?',
                  a: 'Yes — Architect Pay is live on mainnet. All transactions use real USDC and EURC.',
                },
                {
                  q: 'Who pays gas fees?',
                  a: "Circle's Gas Station sponsors all transaction fees for SCA (ERC-4337) wallets. Neither you nor your employees ever need native tokens for gas.",
                },
                {
                  q: 'Why does cross-chain take 20+ minutes?',
                  a: "Circle's Iris attestation service processes cross-chain CCTP transfers in 2–5 minutes. Congestion on source or destination chains can occasionally add extra time.",
                },
                {
                  q: 'What tokens are supported?',
                  a: 'USDC and EURC. USDC is supported on all chains. EURC is supported on Arc, Ethereum, and Base only.',
                },
                {
                  q: 'What if I close the tab during a cross-chain transfer?',
                  a: "The transfer state is saved in your browser's localStorage. When you reopen the app on any page, polling resumes automatically and the transfer will complete.",
                },
                {
                  q: 'Is there a fee?',
                  a: 'Same-chain transfers: free. Cross-chain transfers: 0.01% platform fee (minimum $0.01), plus Circle CCTP has no additional fee at standard finality.',
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border p-5 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <summary className="flex items-center justify-between font-semibold text-white list-none">
                    {item.q}
                    <span className="ml-4 shrink-0 text-lg" style={{ color: '#2aabab' }}>+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: '#888' }}>{item.a}</p>
                </details>
              ))}
            </div>
          </Section>

          {/* Bottom CTA */}
          <div className="rounded-2xl border p-8 text-center" style={{ background: 'rgba(42,171,171,0.05)', borderColor: 'rgba(42,171,171,0.2)' }}>
            <h3 className="mb-2 text-xl font-bold text-white">Ready to get started?</h3>
            <p className="mb-6 text-sm" style={{ color: '#666' }}>Create your account and run your first on-chain payment in minutes.</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black"
              style={{ background: '#2aabab' }}
            >
              <Zap className="h-4 w-4" /> Get Started Free
            </Link>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 px-6 py-8 text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#444' }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span>Architect Pay · Powered by Circle CCTP</span>
          <Link href="/" className="hover:text-white transition-colors">← Back to homepage</Link>
        </div>
      </footer>

    </div>
  )
}
