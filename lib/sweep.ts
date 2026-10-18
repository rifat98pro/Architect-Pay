import { db } from '@/lib/db'
import { checkTransaction, getWalletBalances, sendUsdcPayment } from '@/lib/circle'
import { cctpBurnFast, checkAttestationOnce, mintFromAttestation } from '@/lib/cctp'
import { EURC_CCTP_CHAINS, HUB_CHAIN, type CctpSourceChain } from '@/lib/cctp-chains'
import { FEE_RECIPIENT, SWEEP_MIN_ETHEREUM, sweepFeeFor } from '@/lib/fees'

// Deposits land on whichever chain the sender picked. Consolidating them onto the
// hub is what lets the app show one balance per token and pay out instantly: Arc is
// the only source CCTP quotes at zero bps outbound to every destination, while
// routing chain-to-chain directly costs 1–1.3 bps a leg.
//
// Sweeping is an optimisation, never a precondition for spending — the payment
// planner can still burn from any chain — so this is allowed to be slow, skip work,
// and retry later.

// Every deposit is swept, because the hub is where the money is spent from —
// anything left behind is money the user can see and not use. Only true dust is
// skipped: below a cent a burn rounds to zero and the chain rejects it.
//
// This is deliberately not a gas-based threshold. Sponsoring an Ethereum burn costs
// more than a small deposit is worth, but stranding that deposit costs the user
// more than the gas costs us.
const SWEEP_MIN = parseFloat(process.env.SWEEP_MIN_AMOUNT ?? '0.01')

/** Smallest balance worth consolidating from a given chain. */
function sweepMinimum(chain: CctpSourceChain): number {
  return chain === 'ETH-SEPOLIA' ? SWEEP_MIN_ETHEREUM : SWEEP_MIN
}

/**
 * Take the sweep fee once the funds are on the hub.
 *
 * Charged here rather than on the source chain on purpose: splitting the amount
 * before the burn would mean a second Ethereum transaction, which costs more than
 * the fee recovers. On the hub it is a cheap local transfer.
 *
 * Best-effort. The money has already arrived; failing to collect our own fee is
 * not a reason to mark the sweep unfinished and retry the whole thing.
 */
async function collectSweepFee(
  chain: string, token: string, amount: string, hubWalletId: string,
): Promise<void> {
  const fee = sweepFeeFor(chain)
  if (fee <= 0) return
  // Never take more than arrived. sweepMinimum should prevent this, but a balance
  // can shrink between the threshold check and the burn.
  const charge = Math.min(fee, parseFloat(amount))
  if (!(charge > 0)) return

  try {
    await sendUsdcPayment({
      fromWalletId: hubWalletId,
      toAddress:    FEE_RECIPIENT,
      amount:       charge.toFixed(6),
      token:        token as 'USDC' | 'EURC',
    })
  } catch (err) {
    console.error('[sweep] fee collection failed', { chain, token, charge, err })
  }
}

type WalletWithChains = {
  id:             string
  userId:         string
  circleWalletId: string
  walletAddress:  string
  chainWallets:   { chain: string; circleWalletId: string }[]
}

/**
 * Turn a recorded submission into an on-chain hash.
 *
 * A freshly started sweep stores Circle's transaction id, because waiting for
 * confirmation before recording anything is what strands funds. Returns the hash
 * once the burn confirms, null while it is still pending, and throws if the burn
 * itself failed — in which case nothing was burned and the row is dead.
 */
async function resolveBurnHash(sweep: { id: string; burnTxHash: string | null }): Promise<string | null> {
  const stored = sweep.burnTxHash
  if (!stored) return null
  if (!stored.startsWith('circle_tx:')) return stored

  const { state, txHash } = await checkTransaction(stored.replace('circle_tx:', ''))

  if (state === 'FAILED' || state === 'CANCELLED') {
    await db.sweep.update({
      where: { id: sweep.id },
      data:  { status: 'FAILED', errorMessage: `Burn ${state} — no funds left the source chain` },
    })
    return null
  }

  if ((state === 'CONFIRMED' || state === 'COMPLETE') && txHash) {
    await db.sweep.update({ where: { id: sweep.id }, data: { burnTxHash: txHash } })
    return txHash
  }

  return null // still queued or sent — check again next tick
}

/**
 * Finish sweeps whose burn landed but whose mint never did. Runs before starting
 * new ones so a backlog drains even when there is no time to burn more.
 */
export async function mintPendingSweeps(limit: number, userId?: string): Promise<{ minted: number; errors: string[] }> {
  const errors: string[] = []
  let minted = 0

  const awaitingMint = await db.sweep.findMany({
    where:   { status: 'BURNED', ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'asc' },
    take:    limit,
  })

  for (const sweep of awaitingMint) {
    if (!sweep.burnTxHash || sweep.srcDomain == null || !sweep.receiverWalletId || !sweep.destTransmitter) continue
    try {
      const burnHash = await resolveBurnHash(sweep)
      if (!burnHash) continue // burn not confirmed yet, or it failed outright

      const attested = await checkAttestationOnce(sweep.srcDomain, burnHash)
      if (!attested) continue // not final yet — try again later

      const mintTxHash = await mintFromAttestation({
        message:          attested.message,
        attestation:      attested.attestation,
        receiverWalletId: sweep.receiverWalletId,
        destTransmitter:  sweep.destTransmitter,
      })
      await db.sweep.update({ where: { id: sweep.id }, data: { status: 'COMPLETED', mintTxHash, errorMessage: null } })
      await collectSweepFee(sweep.chain, sweep.token, sweep.amount, sweep.receiverWalletId)
      minted++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mint failed'
      errors.push(`mint ${sweep.id}: ${message}`)
      // Leave it BURNED. The funds are attested and claimable; a transient Circle
      // or RPC failure must not bury them under a FAILED row nobody retries.
      await db.sweep.update({ where: { id: sweep.id }, data: { errorMessage: message } }).catch(() => {})
    }
  }

  return { minted, errors }
}

/**
 * Poll for a sweep's attestation up to a deadline and mint as soon as it lands.
 *
 * The burn and the mint are separate transactions, and between them the funds exist
 * on neither chain. Waiting here closes that window without a round trip: USDC
 * attests in well under a minute, so a deposit is fully consolidated by the time the
 * caller returns. EURC settles at hard finality and will not make the deadline —
 * those stay BURNED for the cron, which is the only reason the cron still exists.
 */
export async function finishSweep(sweepId: string, deadline: number): Promise<boolean> {
  const sweep = await db.sweep.findUnique({ where: { id: sweepId } })
  if (!sweep || sweep.status !== 'BURNED') return false
  if (!sweep.burnTxHash || sweep.srcDomain == null || !sweep.receiverWalletId || !sweep.destTransmitter) return false

  while (Date.now() < deadline) {
    try {
      const burnHash = await resolveBurnHash(sweep)
      const attested = burnHash ? await checkAttestationOnce(sweep.srcDomain, burnHash) : null
      if (attested) {
        const mintTxHash = await mintFromAttestation({
          message:          attested.message,
          attestation:      attested.attestation,
          receiverWalletId: sweep.receiverWalletId,
          destTransmitter:  sweep.destTransmitter,
        })
        await db.sweep.update({ where: { id: sweepId }, data: { status: 'COMPLETED', mintTxHash, errorMessage: null } })
        await collectSweepFee(sweep.chain, sweep.token, sweep.amount, sweep.receiverWalletId)
        return true
      }
    } catch {
      // Transient. Keep polling until the deadline, then leave it for the cron.
    }
    await new Promise((r) => setTimeout(r, 5_000))
  }
  return false
}

// How long a payment or payroll entry can sit unfinished before the sweep stops
// deferring to it. A row that has not moved in this long is stuck, not in flight,
// and without a bound a single abandoned row would block consolidation forever.
const STALE_AFTER_MS = 30 * 60 * 1000

/** True when this user has money moving that a sweep could pull out from under. */
async function hasWorkInFlight(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - STALE_AFTER_MS)

  const busyPayments = await db.payment.count({
    where: {
      senderId:  userId,
      status:    { in: ['PENDING', 'PROCESSING', 'SENDING'] },
      updatedAt: { gte: since },
    },
  })
  if (busyPayments > 0) return true

  const busyPayroll = await db.payrollEntry.count({
    where: {
      status:     { in: ['PENDING', 'SENDING', 'PROCESSING'] },
      updatedAt:  { gte: since },
      payrollRun: { userId },
    },
  })
  return busyPayroll > 0
}

/**
 * Burn every off-hub balance above the threshold toward the hub. Returns how many
 * burns were started; the mints are picked up by mintPendingSweeps later.
 */
export async function sweepWallet(wallet: WalletWithChains, budget: number): Promise<{ burned: number; sweepIds: string[]; errors: string[] }> {
  const errors: string[] = []
  const sweepIds: string[] = []
  let burned = 0

  // A payment or payroll run in flight may have bridged funds onto a chain and be
  // waiting to pay them out. Sweeping those to the hub underneath it would revert
  // the payout with INSUFFICIENT_TOKEN, so leave this user alone until they settle.
  if (await hasWorkInFlight(wallet.userId)) return { burned, sweepIds, errors }

  for (const chainWallet of wallet.chainWallets) {
    if (burned >= budget) break
    const chain = chainWallet.chain as CctpSourceChain
    if (chain === HUB_CHAIN) continue // already home

    let balances: { usdc: string; eurc: string }
    try {
      balances = await getWalletBalances(chainWallet.circleWalletId)
    } catch {
      continue // transient — next tick
    }

    for (const token of ['USDC', 'EURC'] as const) {
      if (burned >= budget) break
      if (token === 'EURC' && !(EURC_CCTP_CHAINS as readonly string[]).includes(chain)) continue

      const available = parseFloat(token === 'EURC' ? balances.eurc : balances.usdc)
      if (!(available >= sweepMinimum(chain))) continue

      // One sweep per chain+token at a time, or the second burn races the first
      // against a balance that has already been spent.
      const inFlight = await db.sweep.count({
        where: { userId: wallet.userId, chain, token, status: 'BURNED' },
      })
      if (inFlight > 0) continue

      // Leave a hair behind: CCTP can take its fee on top of the burn amount and a
      // burn that exceeds the balance by one unit reverts.
      const amount = (Math.floor(available * 0.999 * 1e6) / 1e6).toFixed(6)

      try {
        // Submit and record immediately rather than waiting for confirmation.
        // Waiting first meant a burn that took longer than the 5-minute poll threw
        // before the row was written — while the transaction stayed in the mempool
        // and landed anyway, leaving funds burned with nothing to mint them. The
        // Circle transaction id is resolved to an on-chain hash by the poller.
        const burn = await cctpBurnFast({
          sourceChain:      chain,
          sourceWalletId:   chainWallet.circleWalletId,
          destChain:        HUB_CHAIN,
          destWalletId:     wallet.circleWalletId,
          arcWalletId:      wallet.circleWalletId,
          recipientAddress: wallet.walletAddress,
          amount,
          token,
          feeLevelOverride: 'LOW',
        })

        const row = await db.sweep.create({
          data: {
            userId:           wallet.userId,
            chain,
            token,
            amount,
            status:           'BURNED',
            burnTxHash:       `circle_tx:${burn.burnCircleTxId}`,
            srcDomain:        burn.srcDomain,
            receiverWalletId: burn.receiverWalletId,
            destTransmitter:  burn.destTransmitter,
          },
        })
        sweepIds.push(row.id)
        burned++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Burn failed'
        errors.push(`burn ${wallet.userId} ${chain} ${token}: ${message}`)
      }
    }
  }

  return { burned, sweepIds, errors }
}
