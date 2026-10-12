import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

export const dynamic = 'force-dynamic'

function getClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey:       process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })
}

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ received: [] })

  // DB payments (sent via Architect Pay — include sender profile)
  const dbReceived = await db.payment.findMany({
    where: {
      recipientAddress: { equals: wallet.walletAddress, mode: 'insensitive' },
      status:           'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
    include: {
      sender: {
        select: { username: true, displayName: true, name: true, image: true },
      },
    },
  })

  // Collect all wallet IDs (arc + chain wallets)
  const allWalletIds = [
    wallet.circleWalletId,
    ...wallet.chainWallets.map((cw) => cw.circleWalletId),
  ]

  // Fetch inbound transfers from Circle for all wallets
  let circleInbound: Array<{
    id:          string
    txHash:      string | null
    amount:      string
    token:       string
    chain:       string
    fromAddress: string
    createdAt:   string
  }> = []

  try {
    const client = getClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res    = await client.listTransactions({
      operation: 'TRANSFER',
      txType:    'INBOUND',
      walletIds: allWalletIds,
      pageSize:  50,
    } as any)

    const txs = (res.data?.transactions ?? []) as Array<Record<string, unknown>>

    circleInbound = txs
      .filter((tx) => {
        const symbol = (tx.tokenId as string | undefined) ?? ''
        const amounts = (tx.amounts as Array<{ amount: string; token?: { symbol?: string } }> | undefined) ?? []
        const hasUsdc = amounts.some((a) => a.token?.symbol === 'USDC' || a.token?.symbol === 'EURC')
        return hasUsdc || symbol.includes('USDC') || symbol.includes('EURC')
      })
      .map((tx) => {
        const amounts  = (tx.amounts as Array<{ amount: string; token?: { symbol?: string } }> | undefined) ?? []
        const usdcAmt  = amounts.find((a) => a.token?.symbol === 'USDC' || a.token?.symbol === 'EURC')
        const token    = usdcAmt?.token?.symbol ?? 'USDC'
        const amount   = usdcAmt?.amount ?? '0'
        return {
          id:          tx.id as string,
          txHash:      (tx.txHash as string | undefined) ?? null,
          amount,
          token,
          chain:       (tx.blockchain as string | undefined) ?? '',
          fromAddress: (tx.sourceAddress as string | undefined) ?? '',
          createdAt:   (tx.createDate as string | undefined) ?? new Date().toISOString(),
        }
      })
  } catch (e) {
    console.error('[received] Circle listTransactions failed:', e)
  }

  // Deduplicate: remove Circle txs whose txHash already appears in DB records
  const dbTxHashes = new Set(dbReceived.map((p) => p.txHash).filter(Boolean))
  const externalInbound = circleInbound.filter(
    (tx) => !tx.txHash || !dbTxHashes.has(tx.txHash),
  )

  return NextResponse.json({ received: dbReceived, externalInbound })
}
