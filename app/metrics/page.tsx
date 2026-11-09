import { Metadata } from 'next'
import { getPublicMetrics } from '@/lib/metrics'
import { MetricsView } from '@/components/metrics/metrics-view'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: 'Architect Pay Metrics · Public Traction & Verified On-Chain Analytics',
  description:
    'Real-time, verified product metrics for Architect Pay. Transparent payment volume, active accounts, payroll batches, asset distribution, and on-chain settlement receipts.',
  openGraph: {
    title: 'Architect Pay Metrics · Transparent On-Chain Analytics',
    description:
      'Independently verifiable product traction, payment volume, and payroll stats powered by Circle CCTP on Arc Mainnet.',
    url: 'https://architectpay.website/metrics',
    siteName: 'Architect Pay',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'Architect Pay Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Architect Pay Metrics',
    description: 'Transparent product analytics and verified on-chain traction.',
    images: ['/logo.png'],
  },
}

export default async function MetricsPage() {
  const data = await getPublicMetrics()

  return <MetricsView initialData={data} />
}

