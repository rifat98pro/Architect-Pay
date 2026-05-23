import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { db } from '@/lib/db'
import { CCTP_SOURCE_CHAINS, type CctpSourceChain } from '@/lib/cctp-chains'

function getClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey:       process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })
}

export interface CircleWallet {
  id:      string
  address: string
}

export interface AllChainWallets {
  arcWallet:    CircleWallet
  chainWallets: Partial<Record<CctpSourceChain, CircleWallet>>
  walletSetId:  string
}

/**
 * Create a wallet set with SCA wallets on Arc Testnet + all CCTP source chains.
 * Returns wallet IDs for every chain so they can all be stored in the DB.
 */
export async function createCircleWallet(userId: string): Promise<AllChainWallets> {
  const client = getClient()

  const setRes = await client.createWalletSet({ name: `architect-pay-${userId}` })
  const walletSetId = setRes.data?.walletSet?.id
  if (!walletSetId) throw new Error('Failed to create Circle wallet set')

  const walletRes = await client.createWallets({
    blockchains: ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA', 'ARB-SEPOLIA', 'MATIC-AMOY'],
    count:       1,
    walletSetId,
    accountType: 'SCA',
    metadata:    [{ name: userId, refId: userId }],
  })

  const wallets = walletRes.data?.wallets ?? []
  const find = (chain: string) => wallets.find((w) => w.blockchain === chain)

  const arcRaw = find('ARC-TESTNET')
  if (!arcRaw?.id || !arcRaw?.address) throw new Error('Failed to create Arc wallet')

  const arcWallet: CircleWallet = { id: arcRaw.id, address: arcRaw.address }

  const chainWallets: Partial<Record<CctpSourceChain, CircleWallet>> = {}
  for (const chain of CCTP_SOURCE_CHAINS) {
    const w = find(chain)
    if (w?.id && w?.address) chainWallets[chain] = { id: w.id, address: w.address }
  }

  return { arcWallet, chainWallets, walletSetId }
}

/**
 * Discover all chain wallets for an existing user who pre-dates the multi-chain schema.
 * Looks up the wallet set ID from Circle if not stored, then lists all wallets in that set,
 * stores them in ChainWallet table, and returns the newly created records.
 */
export async function syncChainWallets(
  walletDbId:   string,
  arcWalletId:  string,
  walletSetId:  string | null,
): Promise<{ id: string; walletId: string; chain: string; circleWalletId: string }[]> {
  const client = getClient()

  // Resolve wallet set ID from Circle API if missing from DB
  let setId = walletSetId
  if (!setId) {
    const walletRes = await client.getWallet({ id: arcWalletId })
    setId = walletRes.data?.wallet?.walletSetId ?? null
    if (setId) {
      await db.wallet.update({ where: { id: walletDbId }, data: { walletSetId: setId } })
    }
  }

  const created: { id: string; walletId: string; chain: string; circleWalletId: string }[] = []

  for (const chain of CCTP_SOURCE_CHAINS) {
    // Skip if already in DB
    const existing = await db.chainWallet.findUnique({
      where: { walletId_chain: { walletId: walletDbId, chain } },
    })
    if (existing) { created.push(existing); continue }

    let circleWalletId: string | null = null

    if (setId) {
      // Look up from Circle API
      const res = await client.listWallets({ walletSetId: setId, blockchain: chain as never, pageSize: 5 })
      circleWalletId = res.data?.wallets?.[0]?.id ?? null
    }

    if (!circleWalletId && setId) {
      // Create the missing chain wallet in the same wallet set
      const res = await client.createWallets({
        blockchains: [chain as never],
        count:       1,
        walletSetId: setId,
        accountType: 'SCA',
      })
      circleWalletId = res.data?.wallets?.[0]?.id ?? null
    }

    if (circleWalletId) {
      const record = await db.chainWallet.create({
        data: { walletId: walletDbId, chain, circleWalletId },
      })
      created.push(record)
    }
  }

  return created
}

/**
 * Look up the Circle wallet ID for a specific chain, creating the wallet lazily if needed.
 * Uses the DB ChainWallet table as cache; falls back to Circle API via walletSetId.
 */
export async function getOrCreateChainWalletId(
  walletDbId:  string,
  walletSetId: string,
  chain:       CctpSourceChain,
): Promise<string> {
  const client = getClient()

  // Check cache
  const cached = await db.chainWallet.findUnique({ where: { walletId_chain: { walletId: walletDbId, chain } } })
  if (cached) return cached.circleWalletId

  // Look up from Circle API
  const res = await client.listWallets({ walletSetId, blockchain: chain as never, pageSize: 5 })
  const found = res.data?.wallets?.[0]
  if (!found?.id) {
    // Chain wallet doesn't exist yet — create it in the existing wallet set
    const created = await client.createWallets({
      blockchains: [chain as never],
      count:       1,
      walletSetId,
      accountType: 'SCA',
    })
    const w = created.data?.wallets?.[0]
    if (!w?.id) throw new Error(`Failed to create wallet on ${chain}`)
    await db.chainWallet.create({ data: { walletId: walletDbId, chain, circleWalletId: w.id } })
    return w.id
  }

  // Cache it
  await db.chainWallet.create({ data: { walletId: walletDbId, chain, circleWalletId: found.id } })
  return found.id
}

/**
 * Get USDC balance for any Circle wallet by its wallet ID.
 */
export async function getWalletBalance(circleWalletId: string): Promise<string> {
  const client = getClient()
  const res = await client.getWalletTokenBalance({ id: circleWalletId })
  const usdc = (res.data?.tokenBalances ?? []).find((b) => b.token?.symbol === 'USDC')
  return usdc?.amount ?? '0'
}

/**
 * Get USDC balances across all chains for a wallet.
 * Returns a map of chain -> balance string.
 */
export async function getAllChainBalances(
  arcWalletId: string,
  chainWalletIds: Partial<Record<CctpSourceChain, string>>,
): Promise<Record<string, string>> {
  const entries = await Promise.allSettled([
    getWalletBalance(arcWalletId).then((b) => ['ARC-TESTNET', b] as const),
    ...Object.entries(chainWalletIds).map(([chain, id]) =>
      getWalletBalance(id).then((b) => [chain, b] as const),
    ),
  ])

  const result: Record<string, string> = {}
  for (const e of entries) {
    if (e.status === 'fulfilled') result[e.value[0]] = e.value[1]
  }
  return result
}

/**
 * Send USDC directly from a Circle wallet to any address on the same chain.
 * Used for Arc Testnet → Arc Testnet payments (instant, no CCTP needed).
 */
export async function sendUsdcPayment({
  fromWalletId,
  toAddress,
  amount,
}: {
  fromWalletId: string
  toAddress:    string
  amount:       string
}): Promise<{ id: string; txHash: string | null }> {
  const client = getClient()

  const balRes = await client.getWalletTokenBalance({ id: fromWalletId })
  const usdc = (balRes.data?.tokenBalances ?? []).find((b) => b.token?.symbol === 'USDC')
  if (!usdc?.token?.id) throw new Error('USDC not found in wallet — fund it via the Circle faucet first')

  const txRes = await client.createTransaction({
    walletId:           fromWalletId,
    tokenId:            usdc.token.id,
    destinationAddress: toAddress,
    amount:             [amount],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  const raw    = txRes.data as unknown as Record<string, unknown>
  const tx     = raw?.transaction ?? (raw?.transactions as unknown[])?.[0] ?? raw
  const txId   = (tx as Record<string, unknown>)?.id   as string | undefined
  const txHash = (tx as Record<string, unknown>)?.txHash as string | undefined

  return { id: txId ?? 'pending', txHash: txHash ?? null }
}

/**
 * Execute an arbitrary contract call via Circle's developer-controlled wallet.
 * Gas Station sponsors fees for SCA wallets. Returns the Circle transaction ID.
 */
export async function executeContractCall({
  walletId,
  contractAddress,
  callData,
}: {
  walletId:        string
  contractAddress: string
  callData:        string
}): Promise<string> {
  const client = getClient()

  const res = await client.createContractExecutionTransaction({
    walletId,
    contractAddress,
    callData: callData as `0x${string}`,
    fee: { type: 'level', config: { feeLevel: 'HIGH' } },
  })

  const raw = res.data as unknown as Record<string, unknown>
  const tx  = raw?.transaction ?? (raw?.transactions as unknown[])?.[0] ?? raw
  const id  = (tx as Record<string, unknown>)?.id as string | undefined
  if (!id) throw new Error('Circle did not return a transaction ID for contract execution')
  return id
}

/**
 * Poll Circle until a transaction reaches CONFIRMED or COMPLETE state.
 * Throws if it FAILED. Times out after ~5 minutes.
 */
export async function waitForTransaction(txId: string): Promise<string> {
  const client  = getClient()
  const LIMIT   = 60
  const DELAY   = 5_000

  for (let i = 0; i < LIMIT; i++) {
    const res    = await client.getTransaction({ id: txId } as Parameters<typeof client.getTransaction>[0])
    const tx     = res.data?.transaction as Record<string, unknown> | undefined
    const state  = tx?.state as string | undefined
    const txHash = tx?.txHash as string | undefined

    if (state === 'FAILED' || state === 'CANCELLED') {
      const err = (tx?.errorReason as string) ?? state
      throw new Error(`Transaction ${txId} ${state}: ${err}`)
    }
    if (state === 'CONFIRMED' || state === 'COMPLETE') return txHash ?? txId
    await new Promise((r) => setTimeout(r, DELAY))
  }
  throw new Error(`Transaction ${txId} did not confirm within 5 minutes`)
}
