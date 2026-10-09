'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import Image from 'next/image'
import {
  ArrowRight, Wallet, Send, Users, CheckCircle2,
  Zap, Globe, ShieldCheck, Banknote, Building2,
} from 'lucide-react'

const STEPS = ['welcome', 'wallet', 'explore'] as const
type Step = (typeof STEPS)[number]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [step, setStep] = useState<Step>('welcome')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    try {
      if (localStorage.getItem('ap_onboarded') === 'yes') {
        router.replace('/dashboard')
      }
    } catch {}
  }, [router])

  function finish() {
    try { localStorage.setItem('ap_onboarded', 'yes') } catch {}
    router.push('/dashboard')
  }

  const stepIndex = STEPS.indexOf(step)

  if (loading || !user) return null

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(160deg, #050d1e 0%, #081525 60%, #060f1e 100%)' }}
    >
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5">
        <Image src="/logo.png" alt="Architect Pay" width={36} height={36} className="rounded-xl object-contain" />
        <span className="text-lg font-bold">
          <span style={{ color: '#c5d3ed' }}>Architect</span>
          <span style={{ color: '#2aabab' }}> Pay</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={{
                background: i < stepIndex ? '#2aabab' : i === stepIndex ? 'rgba(42,171,171,0.15)' : 'rgba(255,255,255,0.05)',
                border:     i === stepIndex ? '1px solid rgba(42,171,171,0.5)' : '1px solid transparent',
                color:      i <= stepIndex ? '#2aabab' : '#555',
              }}
            >
              {i < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px w-8" style={{ background: i < stepIndex ? '#2aabab' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div
        className="w-full max-w-lg rounded-2xl p-8"
        style={{
          background:  'linear-gradient(160deg, #0c1a2e 0%, #081422 100%)',
          border:      '1px solid rgba(42,171,171,0.14)',
          boxShadow:   '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── Step 1: Welcome ── */}
        {step === 'welcome' && (
          <div>
            <div className="mb-6 text-center">
              <div className="mb-3 text-4xl">👋</div>
              <h1 className="mb-2 text-2xl font-bold text-white">
                Welcome, {user.name?.split(' ')[0] ?? 'there'}!
              </h1>
              <p className="text-sm text-gray-400">
                Architect Pay lets you pay anyone, anywhere in real USDC — instantly across 7 blockchains.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              {[
                { icon: <Send className="h-5 w-5" />,    title: 'Send Payments', desc: 'Pay individuals or businesses in USDC or EURC'         },
                { icon: <Users className="h-5 w-5" />,   title: 'Run Payroll',   desc: 'Batch-pay your whole team in one click'               },
                { icon: <Globe className="h-5 w-5" />,   title: 'Cross-chain',   desc: 'CCTP bridging across Arc, Ethereum, Base & more'      },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(42,171,171,0.05)', border: '1px solid rgba(42,171,171,0.1)' }}
                >
                  <div className="mb-2 flex justify-center" style={{ color: '#2aabab' }}>{f.icon}</div>
                  <div className="mb-1 text-xs font-semibold text-white">{f.title}</div>
                  <p className="text-[10px] leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('wallet')}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ background: '#2aabab' }}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Wallet ── */}
        {step === 'wallet' && (
          <div>
            <div className="mb-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(42,171,171,0.1)', border: '1px solid rgba(42,171,171,0.2)' }}>
                  <Wallet className="h-7 w-7" style={{ color: '#2aabab' }} />
                </div>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-white">Your wallet is ready</h1>
              <p className="text-sm text-gray-400">
                A Circle smart contract wallet has been provisioned for you on all 7 supported chains. No seed phrase. No gas fees.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              {[
                { icon: <ShieldCheck className="h-4 w-4" />, title: 'Non-custodial & secure',       desc: 'Powered by Circle Developer-Controlled Wallets (ERC-4337)'  },
                { icon: <Zap className="h-4 w-4" />,         title: 'Gas-free transactions',         desc: "Circle's Gas Station sponsors all fees — you pay nothing"   },
                { icon: <Banknote className="h-4 w-4" />,    title: 'Deposit to get started',        desc: 'Send USDC or EURC from any exchange or wallet to your address' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mt-0.5 shrink-0" style={{ color: '#2aabab' }}>{item.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 rounded-xl border border-gray-700 py-3 text-sm font-semibold text-gray-400 transition hover:border-gray-600 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep('explore')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
                style={{ background: '#2aabab' }}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Explore ── */}
        {step === 'explore' && (
          <div>
            <div className="mb-6 text-center">
              <div className="mb-3 text-4xl">🚀</div>
              <h1 className="mb-2 text-2xl font-bold text-white">You&apos;re all set!</h1>
              <p className="text-sm text-gray-400">Here&apos;s where to start. You can always come back to these from the sidebar.</p>
            </div>

            <div className="mb-6 space-y-3">
              {[
                {
                  icon:  <Wallet className="h-5 w-5" />,
                  label: '1. Deposit USDC',
                  desc:  'Go to Dashboard → Deposit. Send USDC from Coinbase, Binance, or any wallet.',
                  color: '#2aabab',
                },
                {
                  icon:  <Send className="h-5 w-5" />,
                  label: '2. Send your first payment',
                  desc:  'Go to Send Payment. Enter a wallet address or @username and pick an amount.',
                  color: '#60a5fa',
                },
                {
                  icon:  <Building2 className="h-5 w-5" />,
                  label: '3. Set up payroll (optional)',
                  desc:  'Add your team under Payroll → Businesses. Run payroll in one click.',
                  color: '#a78bfa',
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mt-0.5 shrink-0" style={{ color: item.color }}>{item.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('wallet')}
                className="flex-1 rounded-xl border border-gray-700 py-3 text-sm font-semibold text-gray-400 transition hover:border-gray-600 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={finish}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
                style={{ background: '#2aabab' }}
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Skip */}
      <button
        onClick={finish}
        className="mt-6 text-xs text-gray-600 transition hover:text-gray-400"
      >
        Skip for now
      </button>
    </div>
  )
}
