import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getWalletBalances, getOrCreateChainWalletId } from '@/lib/circle'
import { EURC_CCTP_CHAINS, type EurcCctpChain } from '@/lib/cctp-chains'
import { computeEurcAggregatePlan } from '@/lib/aggregate'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const amountStr = req.nextUrl.searchParams.get('amount')
  const destChain = req.nextUrl.searchParams.get('dest') ?? 'ARC-TESTNET'
  const amount    = parseFloat(amountStr ?? '0')

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (!EURC_CCTP_CHAINS.includes(destChain as EurcCctpChain)) {
    return NextResponse.json({ error: 'Unsupported destination chain for EURC' }, { status: 400 })
  }

  const wallet = await db.wallet.findUnique({ where: { userId: user.id }, include: { chainWallets: true } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  // Fetch EURC balances across all 3 chains in parallel
  const eurcBalances: Record<string, number> = {}

  await Promise.allSettled(
    [...EURC_CCTP_CHAINS].map(async (chain) => {
      let walletId: string
      if (chain === 'ARC-TESTNET') {
        walletId = wallet.circleWalletId
      } else {
        const cached = wallet.chainWallets.find((cw) => cw.chain === chain)
        if (!cached) {
          if (!wallet.walletSetId) return
          walletId = await getOrCreateChainWalletId(wallet.id, wallet.walletSetId, chain as EurcCctpChain)
        } else {
          walletId = cached.circleWalletId
        }
      }
      const bals = await getWalletBalances(walletId)
      eurcBalances[chain] = parseFloat(bals.eurc)
    }),
  )

  const result = computeEurcAggregatePlan(eurcBalances, amount, destChain)
  return NextResponse.json(result)
}
