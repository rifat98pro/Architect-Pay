export const FEE_BPS       = 1      // 0.01%
export const FEE_MIN       = 0.01   // minimum fee in USDC/EURC
export const FEE_RECIPIENT = '0x4fE583FF8a1B1a5e7B27e0D14484951B65B9Bab8'

/** Returns the platform fee for a given amount (same token as the transfer). */
export function calcFee(amount: number): number {
  return Math.max(amount * (FEE_BPS / 10_000), FEE_MIN)
}

// A withdrawal that leaves Arc costs a bridge on top of the transfer, so there is a
// floor on what is worth sending out. Withdrawals that stay on Arc are a direct send
// and have no minimum, and neither do deposits — money coming in is never turned
// away, whatever the amount.
export const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL ?? '1')
