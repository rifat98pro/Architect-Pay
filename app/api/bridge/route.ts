import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { AppKit } from '@circle-fin/app-kit'
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { z } from 'zod'

export const maxDuration = 300

// Maps Circle wallet chain IDs → AppKit BridgeChain enum values
const CHAIN_MAP: Record<string, string> = {
  'ARC-TESTNET':  'Arc_Testnet',
  'ETH-SEPOLIA':  'Ethereum_Sepolia',
  'BASE-SEPOLIA': 'Base_Sepolia',
  'ARB-SEPOLIA':  'Arbitrum_Sepolia',
  'MATIC-AMOY':   'Polygon_Amoy_Testnet',
}

const schema = z.object({
  amount:    z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  fromChain: z.string(),
  toChain:   z.string(),
})

const kit     = new AppKit()
const adapter = createCircleWalletsAdapter({
  apiKey:       process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
})

function getCircleClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey:       process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })
}

/**
 * Get the on-chain wallet address for the given Circle chain ID.
 * ARC-TESTNET uses the main wallet address stored in the Wallet record.
 * All other chains look up the address via the Circle API.
 */
async function getChainAddress(
  chain: string,
  arcAddress: string,
  walletDbId: string,
): Promise<string> {
  if (chain === 'ARC-TESTNET') return arcAddress

  const chainWallet = await db.chainWallet.findUnique({
    where: { walletId_chain: { walletId: walletDbId, chain } },
  })
  if (!chainWallet) throw new Error(`No wallet found for chain ${chain}`)

  const client = getCircleClient()
  const res = await client.getWallet({ id: chainWallet.circleWalletId })
  const address = res.data?.wallet?.address
  if (!address) throw new Error(`Could not retrieve address for ${chain} wallet`)
  return address
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { amount, fromChain, toChain } = parsed.data

  const kitFrom = CHAIN_MAP[fromChain]
  const kitTo   = CHAIN_MAP[toChain]
  if (!kitFrom || !kitTo) {
    return NextResponse.json({ error: `Unsupported chain: ${!kitFrom ? fromChain : toChain}` }, { status: 400 })
  }

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  try {
    const [fromAddress, toAddress] = await Promise.all([
      getChainAddress(fromChain, wallet.walletAddress, wallet.id),
      getChainAddress(toChain,   wallet.walletAddress, wallet.id),
    ])

    const result = await kit.bridge({
      from: { adapter, chain: kitFrom as any, address: fromAddress },
      to:   { adapter, chain: kitTo   as any, address: toAddress },
      amount,
    })

    const burnStep = result.steps.find((s: any) => s.name?.toLowerCase().includes('burn') || s.type?.toLowerCase().includes('burn'))
    const burnTxHash = burnStep?.txHash ?? null
    const useForwarder = (result as any).destination?.useForwarder ?? false

    if (result.state === 'error') {
      const failedStep = result.steps.find((s: any) => s.state === 'error')
      const msg = (failedStep?.error as { message?: string } | undefined)?.message ?? 'Bridge failed'
      return NextResponse.json({ error: msg, burnTxHash }, { status: 500 })
    }

    const message = result.state === 'pending'
      ? `Transfer initiated${useForwarder ? ' — Circle\'s relayer is processing the Arc Testnet mint, USDC should arrive in 1-3 minutes.' : ' — awaiting confirmation.'}`
      : `Bridge successful! USDC transferred.`

    return NextResponse.json({ success: true, state: result.state, message, burnTxHash, steps: result.steps.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bridge failed'
    console.error('[bridge]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
