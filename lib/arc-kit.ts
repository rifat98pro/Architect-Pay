'use server'

import { AppKit } from '@circle-fin/app-kit'
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets'
import type { DepositChain } from '@/lib/arc-chains'

const kit = new AppKit()

function buildCircleAdapter() {
  return createCircleWalletsAdapter({
    apiKey:       process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })
}

/**
 * Deposit USDC from any supported testnet chain into the Unified Balance.
 *
 * `address` is required because Circle adapter is developer-controlled —
 * the SDK needs to know which specific wallet is depositing.
 */
export async function depositToUnifiedBalance({
  walletAddress,
  sourceChain,
  amount,
}: {
  walletAddress: string
  sourceChain: DepositChain
  amount: string
}) {
  const adapter = buildCircleAdapter()

  return kit.unifiedBalance.deposit({
    from:              { adapter, chain: sourceChain, address: walletAddress },
    amount,
    token:             'USDC',
    allowanceStrategy: 'approve',
  })
}

/**
 * Spend USDC from the Unified Balance to any recipient on Arc Testnet.
 *
 * `from` is an array — the SDK can pull from multiple source adapters.
 * `address` required on both from and to for developer-controlled adapters.
 */
export async function getUnifiedBalance(walletAddress: string): Promise<{ confirmed: string; pending: string }> {
  const res = await kit.unifiedBalance.getBalances({
    sources: { address: walletAddress },
    networkType: 'testnet',
    includePending: true,
  })
  const r = res as unknown as { totalConfirmedBalance: string; totalPendingBalance?: string }
  return {
    confirmed: r.totalConfirmedBalance ?? '0',
    pending:   r.totalPendingBalance   ?? '0',
  }
}

export async function spendFromUnifiedBalance({
  walletAddress,
  recipientAddress,
  amount,
}: {
  walletAddress: string
  recipientAddress: string
  amount: string
}) {
  const adapter = buildCircleAdapter()

  return kit.unifiedBalance.spend({
    amount,
    token: 'USDC',
    from: [{ adapter, address: walletAddress }],
    to: {
      adapter,
      chain: 'Arc_Testnet',
      recipientAddress,
      address: walletAddress,
    },
  })
}
