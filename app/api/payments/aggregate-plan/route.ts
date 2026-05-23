import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { getAllChainBalances } from '@/lib/circle'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'

export interface AggregatePlanEntry {
  chain:    string
  label:    string
  amount:   string // amount to burn / use from this chain
  fee:      string // estimated CCTP fee (0 for Arc)
  isCctp:   boolean
}

export interface AggregatePlan {
  feasible:    boolean
  plan:        AggregatePlanEntry[]
  totalTarget: string
  totalFee:    string
  reason?:     string
}

const CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc Testnet',
  'ETH-SEPOLIA':  'Ethereum Sepolia',
  'BASE-SEPOLIA': 'Base Sepolia',
  'ARB-SEPOLIA':  'Arbitrum Sepolia',
  'MATIC-AMOY':   'Polygon Amoy',
}

export function computeAggregatePlan(
  chainBalances: Record<string, number>,
  targetAmount: number,
): Omit<AggregatePlan, 'feasible'> & { feasible: boolean } {
  const plan: AggregatePlanEntry[] = []
  let remaining  = targetAmount
  let totalFee   = 0

  // Use Arc Testnet first — free and instant
  const arcBal = chainBalances['ARC-TESTNET'] ?? 0
  if (arcBal > 0 && remaining > 0) {
    const use = parseFloat(Math.min(arcBal, remaining).toFixed(6))
    plan.push({ chain: 'ARC-TESTNET', label: 'Arc Testnet', amount: use.toFixed(6), fee: '0', isCctp: false })
    remaining -= use
  }

  // Fill the rest from CCTP chains, largest balance first
  if (remaining > 0.001) {
    const others = CCTP_SOURCE_CHAINS
      .map((c) => ({ chain: c, bal: chainBalances[c] ?? 0 }))
      .filter((x) => x.bal > 0)
      .sort((a, b) => b.bal - a.bal)

    for (const { chain, bal } of others) {
      if (remaining <= 0.001) break

      // Burn slightly more to cover ~1% CCTP fee so net received >= remaining
      const burnAmount  = parseFloat(Math.min(bal, remaining / 0.99).toFixed(6))
      const estimatedFee = parseFloat((burnAmount * 0.01).toFixed(6))
      const netReceived  = burnAmount - estimatedFee

      plan.push({
        chain,
        label:  CHAIN_LABEL[chain] ?? chain,
        amount: burnAmount.toFixed(6),
        fee:    estimatedFee.toFixed(6),
        isCctp: true,
      })

      totalFee  += estimatedFee
      remaining -= netReceived
    }
  }

  const feasible = remaining <= 0.01

  return {
    feasible,
    plan,
    totalTarget: targetAmount.toFixed(6),
    totalFee:    totalFee.toFixed(6),
    reason: feasible ? undefined : 'Insufficient total balance across all chains',
  }
}

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

  const balances     = await getAllChainBalances(wallet.circleWalletId, chainWalletIds)
  const numericBals  = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, parseFloat(v)]))
  const result       = computeAggregatePlan(numericBals, amount)

  return NextResponse.json(result)
}
