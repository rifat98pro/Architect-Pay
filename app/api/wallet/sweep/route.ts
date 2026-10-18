import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { finishSweep, mintPendingSweeps, sweepWallet } from '@/lib/sweep'

export const maxDuration = 300

// Consolidating a deposit onto the hub is housekeeping the user never asked for, so
// it rides along with them opening the app rather than waiting for a cron tick.
// The client fires this and forgets it; nothing in the UI blocks on the result.
export async function POST() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.wallet.findUnique({
    where:   { userId: user.id },
    include: { chainWallets: true },
  })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const { minted }           = await mintPendingSweeps(10, user.id)
  const { burned, sweepIds } = await sweepWallet(wallet, 4)

  // Wait only for burns that can realistically finish here. USDC attests in well
  // under a minute, so the deposit is usually on the hub by the time this returns.
  // EURC settles at hard finality and never would, and holding the function open
  // for it would tie up a request on every page load — those stay BURNED for the
  // next visit or the cron to mint.
  let completed = 0
  for (const id of sweepIds) {
    const sweep = await db.sweep.findUnique({ where: { id }, select: { token: true } })
    if (sweep?.token !== 'USDC') continue
    if (await finishSweep(id, Date.now() + 90_000)) completed++
  }

  return NextResponse.json({ minted: minted + completed, burned })
}
