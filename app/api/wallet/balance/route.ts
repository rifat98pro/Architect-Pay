import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { createCircleWallet, getWalletBalance, getWalletBalances, getAllChainBalances, syncChainWallets } from '@/lib/circle'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })

  // Provision brand-new wallet
  if (!wallet) {
    try {
      const { arcWallet, chainWallets, walletSetId } = await createCircleWallet(user.id)
      wallet = await db.wallet.create({
        data: {
          userId:         user.id,
          circleUserId:   user.id,
          circleWalletId: arcWallet.id,
          walletAddress:  arcWallet.address,
          walletSetId,
          chainWallets: {
            create: Object.entries(chainWallets).map(([chain, w]) => ({
              chain,
              circleWalletId: w.id,
            })),
          },
        },
        include: { chainWallets: true },
      })
    } catch (err) {
      console.error('[wallet/balance] provision failed', err)
      return NextResponse.json({ error: 'Failed to provision wallet' }, { status: 500 })
    }
  }

  // ── Existing user migration: discover chain wallets they're missing ──────────
  const knownChains = new Set(wallet.chainWallets.map((cw) => cw.chain))
  const missingChains = CCTP_SOURCE_CHAINS.filter((c) => !knownChains.has(c))

  if (missingChains.length > 0) {
    const discovered = await syncChainWallets(wallet.id, wallet.circleWalletId, wallet.walletSetId)
    // Merge discovered wallets into chainWallets list
    for (const cw of discovered) {
      if (!knownChains.has(cw.chain)) wallet.chainWallets.push(cw)
    }
  }

  // Build chain wallet ID map
  const chainWalletIds: Partial<Record<CctpSourceChain, string>> = {}
  for (const cw of wallet.chainWallets) {
    if (CCTP_SOURCE_CHAINS.includes(cw.chain as CctpSourceChain)) {
      chainWalletIds[cw.chain as CctpSourceChain] = cw.circleWalletId
    }
  }

  const [balances, arcTokenBalances, eurcEth, eurcBase] = await Promise.all([
    getAllChainBalances(wallet.circleWalletId, chainWalletIds),
    getWalletBalances(wallet.circleWalletId),
    chainWalletIds['ETH-SEPOLIA']
      ? getWalletBalances(chainWalletIds['ETH-SEPOLIA']!)
      : Promise.resolve({ usdc: '0', eurc: '0' }),
    chainWalletIds['BASE-SEPOLIA']
      ? getWalletBalances(chainWalletIds['BASE-SEPOLIA']!)
      : Promise.resolve({ usdc: '0', eurc: '0' }),
  ])

  const eurcChainBalances: Record<string, string> = {
    'ARC-TESTNET':  arcTokenBalances.eurc,
    'ETH-SEPOLIA':  eurcEth.eurc,
    'BASE-SEPOLIA': eurcBase.eurc,
  }
  const eurcBalance = Object.values(eurcChainBalances)
    .reduce((sum, b) => sum + parseFloat(b || '0'), 0)
    .toFixed(6)

  return NextResponse.json({
    address:          wallet.walletAddress,
    balance:          balances['ARC-TESTNET'] ?? '0',
    eurcBalance,
    eurcChainBalances,
    chainBalances:    balances,
  })
}
