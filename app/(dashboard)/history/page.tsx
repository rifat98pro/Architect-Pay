'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { formatUSDC, truncateAddress } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'

const ARC_EXPLORER = 'https://testnet.arcscan.app'

interface Payment {
  id: string
  recipientAddress: string
  recipientLabel: string | null
  amount: string
  status: string
  txHash: string | null
  createdAt: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED:  <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED:     <XCircle className="h-4 w-4 text-red-500" />,
  PENDING:    <Clock className="h-4 w-4 text-yellow-500" />,
  PROCESSING: <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />,
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/payments/history')
      .then((r) => r.json())
      .then((data) => setPayments(data.payments ?? []))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Payment History</h1>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      )}

      {!loading && payments.length === 0 && (
        <div className="card py-12 text-center text-sm text-gray-400">
          No payments yet. Send your first payment from the Send Payment page.
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="card divide-y divide-gray-100 overflow-hidden p-0">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="shrink-0">{STATUS_ICON[p.status]}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900">
                  {p.recipientLabel ?? truncateAddress(p.recipientAddress, 6)}
                </div>
                <div className="font-mono text-xs text-gray-400">
                  {truncateAddress(p.recipientAddress, 6)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  ${formatUSDC(p.amount)} USDC
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
                {p.txHash && (
                  <a
                    href={`${ARC_EXPLORER}/tx/${p.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                  >
                    {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
