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

  // Stay inside the function timeout with room to spare. USDC attests in well under
  // a minute, so this usually returns with the deposit already on the hub; anything
  // slower is left BURNED and the cron finishes it.
  const deadline = Date.now() + 200_000
  let completed  = 0
  for (const id of sweepIds) {
    if (Date.now() >= deadline) break
    if (await finishSweep(id, deadline)) completed++
  }

  return NextResponse.json({ minted: minted + completed, burned })
}
