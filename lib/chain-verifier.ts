import { createPublicClient, http, type Hash, type PublicClient } from 'viem'
import { SOURCE_CHAIN_META, type KnownChain } from '@/lib/cctp-chains'

// In-memory verification cache to eliminate repetitive RPC calls
// Key: `${chain}:${txHash.toLowerCase()}`
interface CachedVerification {
  verified: boolean
  status: 'success' | 'reverted' | 'not_found' | 'error'
  blockNumber?: bigint
  verifiedAt: number
}

const verificationCache = new Map<string, CachedVerification>()
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour TTL for confirmed transactions

// Chain client cache
const clients: Partial<Record<KnownChain, PublicClient>> = {}

function getChainClient(chain: KnownChain): PublicClient | null {
  if (clients[chain]) return clients[chain]!

  const meta = SOURCE_CHAIN_META[chain]
  if (!meta || !meta.rpcUrl) return null

  try {
    const client = createPublicClient({
      transport: http(meta.rpcUrl, {
        timeout: 4_000,
        retryCount: 1,
      }),
    })
    clients[chain] = client
    return client
  } catch {
    return null
  }
}

export interface VerificationResult {
  txHash: string
  chain: string
  verified: boolean
  status: 'success' | 'reverted' | 'not_found' | 'error'
  blockNumber?: number
  checkedAt: string
}

/**
 * Verify a single transaction hash on a specific chain's RPC.
 * Strictly read-only, timeout-bounded, and cached.
 */
export async function verifyTransactionHash(
  txHash: string,
  chainKey: string = 'ARC-TESTNET',
): Promise<VerificationResult> {
  const normalizedHash = txHash.trim().toLowerCase()
  const validHexHash = normalizedHash.startsWith('0x') && normalizedHash.length === 66
    ? (normalizedHash as Hash)
    : null

  if (!validHexHash) {
    return {
      txHash,
      chain: chainKey,
      verified: false,
      status: 'not_found',
      checkedAt: new Date().toISOString(),
    }
  }

  const cacheKey = `${chainKey}:${validHexHash}`
  const cached = verificationCache.get(cacheKey)
  if (cached && Date.now() - cached.verifiedAt < CACHE_TTL_MS) {
    return {
      txHash: validHexHash,
      chain: chainKey,
      verified: cached.verified,
      status: cached.status,
      blockNumber: cached.blockNumber ? Number(cached.blockNumber) : undefined,
      checkedAt: new Date(cached.verifiedAt).toISOString(),
    }
  }

  const client = getChainClient(chainKey as KnownChain)
  if (!client) {
    return {
      txHash: validHexHash,
      chain: chainKey,
      verified: false,
      status: 'error',
      checkedAt: new Date().toISOString(),
    }
  }

  try {
    // Timeout wrapper for safety
    const receiptPromise = client.getTransactionReceipt({ hash: validHexHash })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RPC request timed out')), 4_500)
    )

    const receipt = await Promise.race([receiptPromise, timeoutPromise])

    const isSuccess = receipt.status === 'success'
    const status = isSuccess ? 'success' : 'reverted'

    verificationCache.set(cacheKey, {
      verified: isSuccess,
      status,
      blockNumber: receipt.blockNumber,
      verifiedAt: Date.now(),
    })

    return {
      txHash: validHexHash,
      chain: chainKey,
      verified: isSuccess,
      status,
      blockNumber: Number(receipt.blockNumber),
      checkedAt: new Date().toISOString(),
    }
  } catch {
    // If tx receipt is not found or RPC is unreachable
    return {
      txHash: validHexHash,
      chain: chainKey,
      verified: false,
      status: 'not_found',
      checkedAt: new Date().toISOString(),
    }
  }
}

/**
 * Batch-verify an array of transactions in parallel with bounded concurrency.
 */
export async function batchVerifyTransactions(
  transactions: Array<{ txHash: string | null; chain?: string }>,
  maxConcurrent = 5,
): Promise<{
  totalChecked: number
  verifiedOnChain: number
  pendingOrUnverified: number
}> {
  const eligible = transactions.filter(
    (t): t is { txHash: string; chain: string } =>
      Boolean(t.txHash && t.txHash.startsWith('0x') && t.txHash.length === 66),
  )

  let verifiedOnChain = 0
  let pendingOrUnverified = 0

  // Bounded batch execution
  for (let i = 0; i < eligible.length; i += maxConcurrent) {
    const chunk = eligible.slice(i, i + maxConcurrent)
    const results = await Promise.allSettled(
      chunk.map((t) => verifyTransactionHash(t.txHash, t.chain ?? 'ARC-TESTNET')),
    )

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.verified) {
        verifiedOnChain++
      } else {
        pendingOrUnverified++
      }
    }
  }

  return {
    totalChecked: eligible.length,
    verifiedOnChain,
    pendingOrUnverified: eligible.length - verifiedOnChain,
  }
}

