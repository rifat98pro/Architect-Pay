import { db } from '@/lib/db'
import { getWalletBalances, sendUsdcPayment, waitForTransaction } from '@/lib/circle'
import { logPaymentOnChain } from '@/lib/architect-pay-contract'

export interface ResolvedRecipient {
  isInternal:       boolean
  targetAddress:    string
  targetUsername?:  string
  targetName?:      string
  targetImage?:     string | null
  destChain:        string
  userId?:          string
}

/**
 * Clean and normalize a raw username input.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

/**
 * Determine whether a payment target is an internal Architect Pay user or an external wallet.
 * Resolves registered usernames securely using existing account data.
 */
export async function resolvePaymentRecipient({
  recipientUsername,
  recipientAddress,
  requestedDestChain,
  isUsernamePayment,
}: {
  recipientUsername?:  string | null
  recipientAddress?:   string | null
  requestedDestChain?: string | null
  isUsernamePayment?:  boolean
}): Promise<ResolvedRecipient> {
  // Case 1: Recipient username explicitly provided
  if (recipientUsername && recipientUsername.trim()) {
    const username = normalizeUsername(recipientUsername)
    const targetUser = await db.user.findUnique({
      where:   { username },
      include: { wallet: true },
    })

    if (!targetUser || !targetUser.wallet) {
      throw new Error(`Architect Pay user "@${username}" not found or has no active wallet.`)
    }

    return {
      isInternal:     true,
      targetAddress:  targetUser.wallet.walletAddress,
      targetUsername: targetUser.username ?? username,
      targetName:     targetUser.displayName ?? targetUser.name ?? `@${username}`,
      targetImage:    targetUser.image ?? null,
      destChain:      'ARC-TESTNET',
      userId:         targetUser.id,
    }
  }

  // Case 2: Recipient address provided
  if (recipientAddress && recipientAddress.trim()) {
    const raw = recipientAddress.trim()

    // If sender explicitly indicated wallet-address payment, preserve external flow completely
    if (isUsernamePayment === false && raw.startsWith('0x')) {
      return {
        isInternal:    false,
        targetAddress: raw,
        destChain:     requestedDestChain || 'BASE-SEPOLIA',
      }
    }

    // If input looks like a username (e.g. starts with @ or doesn't match 0x hex)
    if (raw.startsWith('@') || !raw.startsWith('0x')) {
      const username = normalizeUsername(raw)
      const targetUser = await db.user.findUnique({
        where:   { username },
        include: { wallet: true },
      })
      if (targetUser && targetUser.wallet) {
        return {
          isInternal:     true,
          targetAddress:  targetUser.wallet.walletAddress,
          targetUsername: targetUser.username ?? username,
          targetName:     targetUser.displayName ?? targetUser.name ?? `@${username}`,
          targetImage:    targetUser.image ?? null,
          destChain:      'ARC-TESTNET',
          userId:         targetUser.id,
        }
      }
      throw new Error(`Architect Pay user "${raw}" not found.`)
    }

    // If explicitly marked as username payment or no destination chain specified
    if (isUsernamePayment === true) {
      const internalWallet = await db.wallet.findFirst({
        where:   { walletAddress: { equals: raw, mode: 'insensitive' } },
        include: { user: true },
      })

      if (internalWallet) {
        return {
          isInternal:     true,
          targetAddress:  internalWallet.walletAddress,
          targetUsername: internalWallet.user.username ?? undefined,
          targetName:     internalWallet.user.displayName ?? internalWallet.user.name ?? (internalWallet.user.username ? `@${internalWallet.user.username}` : undefined),
          targetImage:    internalWallet.user.image ?? null,
          destChain:      'ARC-TESTNET',
          userId:         internalWallet.userId,
        }
      }
    }

    // External address: keep existing requested destination chain
    return {
      isInternal:    false,
      targetAddress: raw,
      destChain:     requestedDestChain || 'BASE-SEPOLIA',
    }
  }

  throw new Error('A recipient username or valid wallet address is required.')
}

/**
 * Execute an internal payment from the sender's Arc account to the recipient's Arc account.
 * Guarantees zero cross-chain routing, no CCTP/CCTPx, zero platform fees, and instant settlement.
 */
export async function executeInternalArcPayment({
  senderUserId,
  recipientAddress,
  recipientLabel,
  amount,
  token = 'USDC',
}: {
  senderUserId:     string
  recipientAddress: string
  recipientLabel?:  string | null
  amount:           string
  token?:           'USDC' | 'EURC'
}): Promise<{ paymentId: string; txHash: string | null; destChain: string }> {
  const senderWallet = await db.wallet.findUnique({
    where: { userId: senderUserId },
  })
  if (!senderWallet) throw new Error('Sender wallet not found')

  // Prevent sending to self
  if (senderWallet.walletAddress.toLowerCase() === recipientAddress.toLowerCase()) {
    throw new Error('Cannot send payment to your own Architect Pay account.')
  }

  // Validate recipient account on Arc exists
  const recipientWallet = await db.wallet.findFirst({
    where:   { walletAddress: { equals: recipientAddress, mode: 'insensitive' } },
    include: { user: true },
  })
  if (!recipientWallet) {
    throw new Error('Recipient account not found on Arc.')
  }

  const requestedAmount = parseFloat(amount)
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    throw new Error('Invalid payment amount.')
  }

  // Validate sender has sufficient balance directly on Arc
  const senderBalances = await getWalletBalances(senderWallet.circleWalletId)
  const availableOnArc = parseFloat(token === 'EURC' ? senderBalances.eurc : senderBalances.usdc)
  if (availableOnArc < requestedAmount) {
    const symbol = token === 'EURC' ? '€' : '$'
    throw new Error(
      `Insufficient ${token} on Arc. Required: ${symbol}${requestedAmount.toFixed(2)}, Available on Arc: ${symbol}${availableOnArc.toFixed(2)}.`,
    )
  }

  const formattedAmount = requestedAmount.toFixed(6)
  const effectiveLabel  = recipientLabel ?? (recipientWallet.user.username ? `@${recipientWallet.user.username}` : null)

  // Create payment record in PROCESSING state
  const payment = await db.payment.create({
    data: {
      senderId:         senderUserId,
      recipientAddress: recipientWallet.walletAddress,
      recipientLabel:   effectiveLabel,
      amount:           formattedAmount,
      token,
      sourceChain:      'ARC-TESTNET',
      destChain:        'ARC-TESTNET',
      status:           'PROCESSING',
    },
  })

  try {
    // Direct Arc-to-Arc transfer using Circle Gas Station sponsorship
    const result = await sendUsdcPayment({
      fromWalletId: senderWallet.circleWalletId,
      toAddress:    recipientWallet.walletAddress,
      amount:       formattedAmount,
      token,
    })

    let txHash: string | null = result.txHash
    if (!txHash && result.id) {
      try {
        txHash = await waitForTransaction(result.id)
      } catch {
        // Fall back to Circle tx id if hash lookup timed out
        txHash = result.id
      }
    }

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'COMPLETED', txHash },
    })

    // Fire-and-forget on-chain event log
    logPaymentOnChain(senderWallet.circleWalletId, recipientWallet.walletAddress, formattedAmount, effectiveLabel ?? '')

    return {
      paymentId: payment.id,
      txHash,
      destChain: 'ARC-TESTNET',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal transfer failed'
    await db.payment.update({
      where: { id: payment.id },
      data:  { status: 'FAILED', errorMessage: message },
    })
    throw new Error(message)
  }
}
