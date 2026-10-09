import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { swapTokens } from '@/lib/arc-kit'
import { getChainWalletAddress, sendUsdcPayment } from '@/lib/circle'
import { calcFee, FEE_RECIPIENT } from '@/lib/fees'
import { z } from 'zod'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

const CHAIN_MAP: Record<string, string> = {
  'ARC-TESTNET':  'Arc',
  'ETH-SEPOLIA':  'Ethereum',
  'BASE-SEPOLIA': 'Base',
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

    const isCrossChain = srcChain !== destChain
    let swapAmountIn   = amountIn

    if (isCrossChain) {
      const amountNum  = parseFloat(amountIn)
      const platformFee = calcFee(amountNum)
      swapAmountIn     = (amountNum - platformFee).toFixed(6)

      // Send fee to platform wallet on source chain (tokenIn currency)
      const srcWalletId = srcChain === 'ARC-TESTNET'
        ? wallet.circleWalletId
        : wallet.chainWallets.find((w) => w.chain === srcChain)?.circleWalletId
      if (srcWalletId) {
        await sendUsdcPayment({
          fromWalletId: srcWalletId,
          toAddress:    FEE_RECIPIENT,
          amount:       platformFee.toFixed(6),
          token:        tokenIn,
        })
      }
    }

    let swapResult: Awaited<ReturnType<typeof swapTokens>> | null = null
    let swapError: string | null = null
    try {
      swapResult = await swapTokens({
        walletAddress: srcAddress,
        tokenIn,
        tokenOut,
        amountIn:  swapAmountIn,
        chain:     CHAIN_MAP[srcChain],
        toChain:   CHAIN_MAP[destChain],
        toAddress: destAddress,
      })
    } catch (e) {
      swapError = e instanceof Error ? e.message : 'Swap failed'
    }

    // Record swap regardless of outcome
    await db.swapHistory.create({
      data: {
        userId:   user.id,
        tokenIn,
        tokenOut,
        amountIn: swapAmountIn,
        amountOut: swapResult ? String((swapResult as { amountOut?: string | number })?.amountOut ?? '') : null,
        srcChain,
        destChain,
        status:   swapError ? 'FAILED' : 'COMPLETED',
        txHash:   swapResult ? String((swapResult as { txHash?: string })?.txHash ?? '') || null : null,
        errorMsg: swapError,
      },
    }).catch(() => {/* non-fatal */})

    if (swapError) {
      console.error('[swap]', swapError)
      return NextResponse.json({ error: swapError }, { status: 500 })
    }

    return NextResponse.json({ success: true, result: swapResult })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Swap failed'
    console.error('[swap]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
