export const FEE_BPS       = 1    // 0.01%
export const FEE_MIN_USD   = 0.10 // minimum fee in USDC
export const FEE_RECIPIENT = '0x4fE583FF8a1B1a5e7B27e0D14484951B65B9Bab8'

/** Returns the platform fee for a given amount (same token as the transfer). */
export function calcFee(amount: number): number {
  return Math.max(amount * (FEE_BPS / 10_000), FEE_MIN_USD)
}
