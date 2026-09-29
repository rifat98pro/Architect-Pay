import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { swapTokens } from '@/lib/arc-kit'
import { getChainWalletAddress } from '@/lib/circle'
import { z } from 'zod'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

const CHAIN_MAP: Record<string, string> = {
  'ARC-TESTNET':  'Arc_Testnet',
  'ETH-SEPOLIA':  'Ethereum_Sepolia',
  'BASE-SEPOLIA': 'Base_Sepolia',
}

const CHAINS = ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA'] as const

const schema = z.object({
  tokenIn:   z.enum(['EURC', 'USDC']),
  tokenOut:  z.enum(['EURC', 'USDC']),
  amountIn:  z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/)
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
  srcChain:  z.enum(CHAINS).default('ARC-TESTNET'),
  destChain: z.enum(CHAINS).default('ARC-TESTNET'),
}).refine((d) => d.tokenIn !== d.tokenOut, { message: 'tokenIn and tokenOut must differ' })

async function resolveWalletAddress(
  wallet: { walletAddress: string; chainWallets: { chain: string; circleWalletId: string }[] },
  chain: string,
): Promise<string> {
  if (chain === 'ARC-TESTNET') return wallet.walletAddress
  const cw = wallet.chainWallets.find((w) => w.chain === chain)
  if (!cw) throw new Error(`No wallet for ${chain}`)
  return getChainWalletAddress(cw.circleWalletId)
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { tokenIn, tokenOut, amountIn, srcChain, destChain } = parsed.data

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  try {
    const [srcAddress, destAddress] = await Promise.all([
      resolveWalletAddress(wallet, srcChain),
      resolveWalletAddress(wallet, destChain),
    ])

    const result = await swapTokens({
      walletAddress: srcAddress,
      tokenIn,
      tokenOut,
      amountIn,
      chain:     CHAIN_MAP[srcChain],
      toChain:   CHAIN_MAP[destChain],
      toAddress: destAddress,
    })

    return NextResponse.json({ success: true, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Swap failed'
    console.error('[swap]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
