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

/**
 * Swap EURC ↔ USDC on Arc Testnet via the Circle App Kit.
 * tokenIn/tokenOut: 'EURC' | 'USDC'
 */
export async function swapTokens({
  walletAddress,
  tokenIn,
  tokenOut,
  amountIn,
  chain = 'Arc_Testnet',
  toChain,
  toAddress,
}: {
  walletAddress: string
  tokenIn:       'EURC' | 'USDC'
  tokenOut:      'EURC' | 'USDC'
  amountIn:      string
  chain?:        string
  toChain?:      string
  toAddress?:    string
}) {
  const adapter      = buildCircleAdapter()
  const isCrossChain = toChain && toChain !== chain

  const params = {
    from:   { adapter, chain: chain as never, address: walletAddress },
    tokenIn,
    tokenOut,
    amountIn,
    ...(isCrossChain ? { to: { chain: toChain as never, recipientAddress: toAddress ?? walletAddress } } : {}),
    config: { slippageBps: 100, allowanceStrategy: 'approve' },
  }

  const result = await kit.swap(params as never) as Record<string, unknown>

  // Cross-chain swaps start PENDING — try to wait up to 55s for completion
  if ((result?.progress as Record<string, unknown>)?.status === 'PENDING') {
    try {
      const finalStatus = await Promise.race([
        kit.waitForSwap({ result: result as never, apiKey: process.env.CIRCLE_API_KEY }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 55_000)),
      ])
      return { ...result, finalStatus, pending: false }
    } catch {
      return { ...result, pending: true }
    }
  }

  return { ...result, pending: false }
}
