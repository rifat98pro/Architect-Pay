export const FEE_BPS       = 1      // 0.01%
export const FEE_MIN       = 0.01   // minimum fee in USDC/EURC
export const FEE_RECIPIENT = '0x4fE583FF8a1B1a5e7B27e0D14484951B65B9Bab8'

/** Returns the platform fee for a given amount (same token as the transfer). */
export function calcFee(amount: number): number {
  return Math.max(amount * (FEE_BPS / 10_000), FEE_MIN)
}

// Gas is sponsored, so every chain a transaction touches is a cost we carry. On
// Arc and the L2s that is a fraction of a cent and not worth charging for. On
// Ethereum an approve, a burn or a mint is a few dollars each, whatever the amount.
//
// The percentage fee cannot cover that: at 1 bp, $6 of gas needs a $60,000
// transfer to break even. So Ethereum carries a flat surcharge per leg instead.
// Flat, because the cost is flat — gas does not care how much value moves.
//
// Sized from a real Gas Station invoice (18 Oct 2026): roughly $5-6 per Ethereum
// operation. Tune against the console rather than guessing; gas prices move.
export const ETHEREUM_LEG_FEE = parseFloat(process.env.ETHEREUM_LEG_FEE ?? '6')

/** The flat surcharge for a transfer that touches Ethereum on either end. */
export function ethereumSurcharge(...chains: Array<string | null | undefined>): number {
  const legs = chains.filter((c) => c === 'ETH-SEPOLIA').length
  return legs * ETHEREUM_LEG_FEE
}

// Sweeping is one Ethereum leg, so it costs the same as any other.
export const SWEEP_FEE_ETHEREUM = ETHEREUM_LEG_FEE

// Never let the fee swallow the deposit. Below this an Ethereum balance is left
// where it is — still visible, still spendable, just not consolidated.
export const SWEEP_MIN_ETHEREUM = parseFloat(process.env.SWEEP_MIN_AMOUNT_ETHEREUM ?? '20')

/** Flat sweep fee for consolidating a chain's balance onto the hub. */
export function sweepFeeFor(chain: string): number {
  return ethereumSurcharge(chain)
}
