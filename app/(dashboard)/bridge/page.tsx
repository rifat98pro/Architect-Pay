'use client'

import { Shuffle, Wallet, Clock } from 'lucide-react'

const features = [
  {
    icon: Wallet,
    title: 'DeFi Wallet Bridge',
    description: 'Connect your MetaMask or any DeFi wallet and bridge tokens across chains using integrated bridge protocols.',
  },
  {
    icon: Shuffle,
    title: 'Architect Pay Wallet Bridge',
    description: 'Bridge USDC across chains directly from your Architect Pay balance using Circle CCTP.',
  },
]

export default function BridgePage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bridge</h1>
      <p className="text-gray-500 mb-8">Move tokens seamlessly across networks.</p>

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
