import { CCTP_SOURCE_CHAINS, EURC_CCTP_CHAINS, HUB_CHAIN } from '@/lib/cctp-chains'

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

// CCTP V2 fast transfers cost roughly 1 basis point. Budget 0.1% so a slightly
// larger actual fee can't leave the plan short, without inventing a shortfall
// big enough to drag in an extra chain.
const CCTP_FEE_RATE = 0.001

// Amounts round to 6 decimals, and a burn that rounds to zero is rejected on-chain.
// Anything under a cent isn't worth a cross-chain transfer anyway.
const MIN_BURN = 0.01

// Never commit a chain's entire balance. The bridge can take a fee on top of the
// burn amount, and a burn that exceeds the balance by even one unit reverts with
// INSUFFICIENT_TOKEN — which aborts the whole payment after other legs have burned.
function spendable(balance: number): number {
  return Math.floor(balance * (1 - CCTP_FEE_RATE) * 1e6) / 1e6
}

const CHAIN_LABEL: Record<string, string> = {
  'ARC-TESTNET':  'Arc',
  'ETH-SEPOLIA':  'Ethereum',
  'BASE-SEPOLIA': 'Base',
  'ARB-SEPOLIA':  'Arbitrum',
  'MATIC-AMOY':   'Polygon',
  'AVAX-FUJI':    'Avalanche',
  'OP-SEPOLIA':   'Optimism',
}

export function computeAggregatePlan(
  chainBalances: Record<string, number>,
  targetAmount: number,
  destChain: string = HUB_CHAIN,
): AggregatePlan {
  const plan: AggregatePlanEntry[] = []
  let remaining = targetAmount
  let totalFee  = 0

  // Funds already on destChain are instant — no CCTP needed (ignore dust < $0.01)
  const destBal = chainBalances[destChain] ?? 0
  if (destBal >= 0.01 && remaining > 0) {
    const use = parseFloat(Math.min(destBal, remaining).toFixed(6))
    plan.push({ chain: destChain, label: CHAIN_LABEL[destChain] ?? destChain, amount: use.toFixed(6), fee: '0', isCctp: false })
    remaining -= use
  }

  if (remaining > 0.001) {
    const others = CCTP_SOURCE_CHAINS
      .filter((c) => c !== destChain)
      .map((c) => ({ chain: c, bal: chainBalances[c] ?? 0 }))
      // Below a cent the burn rounds to zero and the chain rejects it, so skip dust.
      .filter((x) => x.bal >= MIN_BURN)
      .sort((a, b) => b.bal - a.bal)

    for (const { chain, bal } of others) {
      if (remaining <= 0.001) break
      const burnAmount   = parseFloat(Math.min(spendable(bal), remaining / (1 - CCTP_FEE_RATE)).toFixed(6))
      if (burnAmount < MIN_BURN) continue
      const estimatedFee = parseFloat((burnAmount * CCTP_FEE_RATE).toFixed(6))
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

// EURC aggregate plan: consolidate from all 3 EURC chains to `destChain`
export function computeEurcAggregatePlan(
  eurcBalances: Record<string, number>,
  targetAmount: number,
  destChain: string,
): AggregatePlan {
  const plan: AggregatePlanEntry[] = []
  let remaining = targetAmount
  let totalFee  = 0

  // Use dest chain balance first (no CCTPx fee)
  const destBal = eurcBalances[destChain] ?? 0
  if (destBal > 0 && remaining > 0) {
    const use = parseFloat(Math.min(destBal, remaining).toFixed(6))
    plan.push({ chain: destChain, label: CHAIN_LABEL[destChain] ?? destChain, amount: use.toFixed(6), fee: '0', isCctp: false })
    remaining -= use
  }

  // Pull from other EURC chains via CCTPx. A route is only usable if one endpoint
  // is Arc — CCTPx quotes a zero fee for those, but charges a native-token fee for
  // Base↔Ethereum (~0.0001 ETH), and our Circle wallets hold no native balance
  // because gas is sponsored, so crossChainTransfer would revert.
  const arcInvolved = destChain === 'ARC-TESTNET'
  if (remaining > 0.001) {
    const others = [...EURC_CCTP_CHAINS]
      .filter((c) => c !== destChain && (arcInvolved || c === 'ARC-TESTNET'))
      .map((c) => ({ chain: c as string, bal: eurcBalances[c] ?? 0 }))
      .filter((x) => x.bal >= MIN_BURN)
      .sort((a, b) => b.bal - a.bal)

    for (const { chain, bal } of others) {
      if (remaining <= 0.001) break
      const burnAmount = parseFloat(Math.min(spendable(bal), remaining).toFixed(6))
      if (burnAmount < MIN_BURN) continue
      plan.push({ chain, label: CHAIN_LABEL[chain] ?? chain, amount: burnAmount.toFixed(6), fee: '0', isCctp: true })
      remaining -= burnAmount
    }
  }

  const feasible = remaining <= 0.01
  return {
    feasible,
    plan,
    totalTarget: targetAmount.toFixed(6),
    totalFee:    totalFee.toFixed(6),
    reason: feasible ? undefined : 'Insufficient total EURC balance across all chains',
  }
}
