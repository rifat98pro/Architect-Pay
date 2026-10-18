export const FEE_BPS       = 1      // 0.01%
export const FEE_MIN       = 0.01   // minimum fee in USDC/EURC
export const FEE_RECIPIENT = '0x4fE583FF8a1B1a5e7B27e0D14484951B65B9Bab8'

/** Returns the platform fee for a given amount (same token as the transfer). */
export function calcFee(amount: number): number {
  return Math.max(amount * (FEE_BPS / 10_000), FEE_MIN)
}

// Consolidating a deposit onto the hub costs gas we sponsor. Everywhere except
// Ethereum that is a fraction of a cent and not worth charging for; an Ethereum
// approve plus depositForBurn runs a few dollars whatever the amount, so that one
// sweep carries a flat fee instead of being absorbed.
//
// Flat, not proportional, because the cost is flat — gas does not care how much
// value moves. Sized from a real Gas Station invoice: roughly $5-6 per Ethereum
// operation, about double on a wallet's first sweep when the approve has not been
// cached yet. Tune it against the console rather than guessing; gas prices move.
export const SWEEP_FEE_ETHEREUM = parseFloat(process.env.SWEEP_FEE_ETHEREUM ?? '6')

// Never let the fee swallow the deposit. Below this an Ethereum balance is left
// where it is — still visible, still spendable, just not consolidated.
export const SWEEP_MIN_ETHEREUM = parseFloat(process.env.SWEEP_MIN_AMOUNT_ETHEREUM ?? '20')

/** Flat sweep fee for consolidating a chain's balance onto the hub. */
export function sweepFeeFor(chain: string): number {
  return chain === 'ETH-SEPOLIA' ? SWEEP_FEE_ETHEREUM : 0
}
