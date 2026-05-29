import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/context/auth-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Architect Pay',
  description: 'Pay employees and bills with USDC on Arc Testnet',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="talentapp:project_verification" content="674521d3031f041cb7b7ce2e25042b7a7997c6f1c9adcf736a8a322d0064a629eb42badf4cd39c0c2b2b88cb86d8a4e118c83bf0eacc0db6844588745b035735" />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
