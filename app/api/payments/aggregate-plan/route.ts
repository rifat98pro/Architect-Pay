import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances } from '@/lib/circle'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'
import { computeAggregatePlan } from '@/lib/aggregate'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const amountStr = req.nextUrl.searchParams.get('amount')
  const amount    = parseFloat(amountStr ?? '0')
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const wallet = await db.wallet.findUnique({ where: { userId: user.id }, include: { chainWallets: true } })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  const balances    = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))
  const result      = computeAggregatePlan(numericBals, amount)

  return NextResponse.json(result)
}
