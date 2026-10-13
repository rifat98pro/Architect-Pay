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

// Circle returns a token UUID on each transaction, not a symbol. Token metadata is
// immutable, so cache the lookup for the lifetime of the serverless instance.
const tokenSymbols = new Map<string, string>()

async function resolveTokenSymbol(
  client: ReturnType<typeof getClient>,
  tokenId: string | undefined,
): Promise<string> {
  if (!tokenId) return 'USDC'
  const cached = tokenSymbols.get(tokenId)
  if (cached) return cached
  try {
    const res    = await client.getToken({ id: tokenId })
    const symbol = res.data?.token?.symbol ?? 'USDC'
    tokenSymbols.set(tokenId, symbol)
    return symbol
  } catch {
    return 'USDC'
  }
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
    // Passing `operation` here makes Circle reject the request as "API parameter
    // invalid", so filter on it client-side instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await client.listTransactions({
      txType:    'INBOUND',
      walletIds: allWalletIds,
      pageSize:  50,
    } as any)

    const txs = (res.data?.transactions ?? []) as unknown as Array<Record<string, unknown>>

    const ZERO = '0x0000000000000000000000000000000000000000'
    const deposits = txs.filter((tx) => {
      if (tx.operation !== 'TRANSFER') return false
      const from = ((tx.sourceAddress as string | undefined) ?? '').toLowerCase()
      // A zero source is a CCTP mint (our own bridging), not an external deposit.
      if (!from || from === ZERO) return false
      // Skip transfers the user sent to themselves between their own wallets.
      if (from === wallet.walletAddress.toLowerCase()) return false
      return parseFloat(((tx.amounts as string[] | undefined) ?? [])[0] ?? '0') > 0
    })

    // tokenId is a UUID — resolve it to a symbol (cached across requests).
    const symbols = await Promise.all(
      deposits.map((tx) => resolveTokenSymbol(client, tx.tokenId as string | undefined)),
    )

    circleInbound = deposits.map((tx, i) => ({
      id:          tx.id as string,
      txHash:      (tx.txHash as string | undefined) ?? null,
      amount:      ((tx.amounts as string[] | undefined) ?? [])[0] ?? '0',
      token:       symbols[i],
      chain:       (tx.blockchain as string | undefined) ?? '',
      fromAddress: (tx.sourceAddress as string | undefined) ?? '',
      createdAt:   (tx.createDate as string | undefined) ?? new Date().toISOString(),
    }))
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
