import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runs = await db.payrollRun.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    20,
    include: {
      entries: {
        include: { employee: { select: { name: true, walletAddress: true, preferredToken: true } } },
      },
      business: { select: { name: true } },
    },
  })

  // Auto-correct runs stuck at PROCESSING where all entries have reached a terminal state
  const fixedRuns = await Promise.all(
    runs.map(async (run) => {
      if (run.status !== 'PROCESSING' || run.entries.length === 0) return run
      const terminal = run.entries.every((e) => e.status === 'COMPLETED' || e.status === 'FAILED')
      if (!terminal) return run
      const completed = run.entries.filter((e) => e.status === 'COMPLETED').length
      const failed    = run.entries.filter((e) => e.status === 'FAILED').length
      const newStatus = failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
      await db.payrollRun.update({ where: { id: run.id }, data: { status: newStatus } })
      return { ...run, status: newStatus }
    }),
  )

  return NextResponse.json({ runs: fixedRuns })
}
