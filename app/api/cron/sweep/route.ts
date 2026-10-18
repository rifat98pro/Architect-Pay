import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mintPendingSweeps, sweepWallet } from '@/lib/sweep'

export const maxDuration = 300

// Safety net. The sweep normally runs on demand the moment a user's balance is
// read, so this only catches wallets nobody has looked at lately.
const MAX_MINTS_PER_RUN = 15
const MAX_BURNS_PER_RUN = 8

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { minted, errors } = await mintPendingSweeps(MAX_MINTS_PER_RUN)

  let burned = 0
  const wallets = await db.wallet.findMany({ include: { chainWallets: true } })
  for (const wallet of wallets) {
    if (burned >= MAX_BURNS_PER_RUN) break
    const res = await sweepWallet(wallet, MAX_BURNS_PER_RUN - burned)
    burned += res.burned
    errors.push(...res.errors)
  }

  return NextResponse.json({ minted, burned, errors: errors.slice(0, 10) })
}
