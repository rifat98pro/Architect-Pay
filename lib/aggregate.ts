import { CCTP_SOURCE_CHAINS } from '@/lib/cctp-chains'

export interface AggregatePlanEntry {
  chain:   string
  label:   string
  amount:  string
  fee:     string
  isCctp:  boolean
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
): AggregatePlan {
  const plan: AggregatePlanEntry[] = []
  let remaining = targetAmount
  let totalFee  = 0

  const arcBal = chainBalances['ARC-TESTNET'] ?? 0
  if (arcBal > 0 && remaining > 0) {
    const use = parseFloat(Math.min(arcBal, remaining).toFixed(6))
    plan.push({ chain: 'ARC-TESTNET', label: 'Arc Testnet', amount: use.toFixed(6), fee: '0', isCctp: false })
    remaining -= use
  }

  if (remaining > 0.001) {
    const others = CCTP_SOURCE_CHAINS
      .map((c) => ({ chain: c, bal: chainBalances[c] ?? 0 }))
      .filter((x) => x.bal > 0)
      .sort((a, b) => b.bal - a.bal)

    for (const { chain, bal } of others) {
      if (remaining <= 0.001) break
      const burnAmount   = parseFloat(Math.min(bal, remaining / 0.99).toFixed(6))
      const estimatedFee = parseFloat((burnAmount * 0.01).toFixed(6))
      const netReceived  = burnAmount - estimatedFee
      plan.push({ chain, label: CHAIN_LABEL[chain] ?? chain, amount: burnAmount.toFixed(6), fee: estimatedFee.toFixed(6), isCctp: true })
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
