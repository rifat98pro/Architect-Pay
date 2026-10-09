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

const STEP_LABELS = ['Welcome', 'Your Wallet', 'Get Started']

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
      style={{ background: '#05111f' }}
    >
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5">
        <Image src="/logo.png" alt="Architect Pay" width={34} height={34} className="rounded-xl object-contain" />
        <span className="text-base font-bold tracking-tight">
          <span style={{ color: '#c5d3ed' }}>Architect</span>
          <span style={{ color: '#2aabab' }}> Pay</span>
        </span>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: i < stepIndex ? '#2aabab' : i === stepIndex ? 'rgba(42,171,171,0.12)' : 'transparent',
                  border:     i === stepIndex ? '1px solid rgba(42,171,171,0.4)' : i < stepIndex ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color:      i <= stepIndex ? '#2aabab' : '#444',
                }}
              >
                {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-medium" style={{ color: i === stepIndex ? '#c5d3ed' : '#444' }}>
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-px w-10" style={{ background: i < stepIndex ? 'rgba(42,171,171,0.4)' : 'rgba(255,255,255,0.07)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: '#0b1929',
          border:     '1px solid rgba(255,255,255,0.07)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >

        {/* ── Step 1: Welcome ── */}
        {step === 'welcome' && (
          <div>
            <div className="mb-7">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Account Created</p>
              <h1 className="mb-2 text-2xl font-bold text-white">
                Welcome, {user.name?.split(' ')[0] ?? 'there'}
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7a8d' }}>
                Your Architect Pay account is ready. Here&apos;s a quick overview of what you can do.
              </p>
            </div>

            <div className="mb-7 space-y-3">
              {[
                { icon: <Send className="h-4 w-4" />,   title: 'Send Payments',  desc: 'Pay any wallet address or @username in USDC or EURC'        },
                { icon: <Users className="h-4 w-4" />,  title: 'Run Payroll',    desc: 'Add employees and batch-pay your entire team in one click'   },
                { icon: <Globe className="h-4 w-4" />,  title: 'Cross-chain',    desc: 'Bridge USDC via Circle CCTP across Arc, Ethereum, Base & more' },
              ].map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3.5 rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="mt-0.5 shrink-0" style={{ color: '#2aabab' }}>{f.icon}</div>
                  <div>
                    <div className="mb-0.5 text-sm font-semibold text-white">{f.title}</div>
                    <p className="text-xs leading-relaxed" style={{ color: '#4f5f6f' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('wallet')}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ background: '#2aabab' }}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Wallet ── */}
        {step === 'wallet' && (
          <div>
            <div className="mb-7">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Your Wallet</p>
              <h1 className="mb-2 text-2xl font-bold text-white">No setup required</h1>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7a8d' }}>
                A Circle smart contract wallet has been provisioned for you across all supported chains automatically.
              </p>
            </div>

            <div className="mb-7 space-y-3">
              {[
                { icon: <ShieldCheck className="h-4 w-4" />, title: 'No seed phrase',        desc: 'Powered by Circle Developer-Controlled Wallets (ERC-4337 SCA)'  },
                { icon: <Zap className="h-4 w-4" />,         title: 'Zero gas fees',          desc: "Circle Gas Station sponsors all transaction fees on every chain" },
                { icon: <Banknote className="h-4 w-4" />,    title: 'Deposit to get started', desc: 'Send USDC or EURC from any exchange or external wallet'         },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mt-0.5 shrink-0" style={{ color: '#2aabab' }}>{item.icon}</div>
                  <div>
                    <div className="mb-0.5 text-sm font-semibold text-white">{item.title}</div>
                    <p className="text-xs leading-relaxed" style={{ color: '#4f5f6f' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:border-gray-600"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6b7a8d' }}
              >
                Back
              </button>
              <button
                onClick={() => setStep('explore')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition hover:opacity-90"
                style={{ background: '#2aabab' }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Get Started ── */}
        {step === 'explore' && (
          <div>
            <div className="mb-7">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#2aabab' }}>Ready</p>
              <h1 className="mb-2 text-2xl font-bold text-white">Where to begin</h1>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7a8d' }}>
                Follow these three steps to make your first transaction.
              </p>
            </div>

            <div className="mb-7 space-y-3">
              {[
                {
                  icon:  <Wallet className="h-4 w-4" />,
                  step:  '01',
                  title: 'Deposit USDC',
                  desc:  'Dashboard → Deposit. Send USDC from Coinbase, Binance, or any wallet to your address.',
                },
                {
                  icon:  <Send className="h-4 w-4" />,
                  step:  '02',
                  title: 'Send a payment',
                  desc:  'Go to Send Payment. Enter a wallet address or @username, set an amount, and confirm.',
                },
                {
                  icon:  <Building2 className="h-4 w-4" />,
                  step:  '03',
                  title: 'Set up payroll',
                  desc:  'Add your team under Businesses, set salaries, and run payroll in one click.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mt-0.5 shrink-0" style={{ color: '#2aabab' }}>{item.icon}</div>
                  <div>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: '#2aabab' }}>{item.step}</span>
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#4f5f6f' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('wallet')}
                className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:border-gray-600"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6b7a8d' }}
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

      <button
        onClick={finish}
        className="mt-6 text-xs transition hover:text-gray-400"
        style={{ color: '#2d3a47' }}
      >
        Skip for now
      </button>
    </div>
  )
}
