import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUSDC(amount: string | number): string {
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function truncateAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return '—'
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`
}
