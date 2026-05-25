'use client'

import { ArrowLeftRight, Wallet, Clock } from 'lucide-react'

const features = [
  {
    icon: Wallet,
    title: 'DeFi Wallet Swap',
    description: 'Connect your MetaMask or any DeFi wallet and swap tokens directly on-chain through integrated DEX protocols.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Architect Pay Wallet Swap',
    description: 'Swap USDC to other tokens directly from your Architect Pay balance without leaving the app.',
  },
]

export default function SwapPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Swap</h1>
      <p className="text-gray-500 mb-8">Exchange tokens across networks.</p>

      <div className="space-y-4">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <Icon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                    <Clock className="h-3 w-3" />
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
