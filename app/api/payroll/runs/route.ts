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

  const TEN_MIN_MS = 10 * 60 * 1000

  // Auto-correct/auto-fail runs stuck at PROCESSING
  const fixedRuns = await Promise.all(
    runs.map(async (run) => {
      if (run.status !== 'PROCESSING' || run.entries.length === 0) return run

      // All entries terminal → fix run status
      const terminal = run.entries.every((e) => e.status === 'COMPLETED' || e.status === 'FAILED')
      if (terminal) {
        const completed = run.entries.filter((e) => e.status === 'COMPLETED').length
        const failed    = run.entries.filter((e) => e.status === 'FAILED').length
        const newStatus = failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
        await db.payrollRun.update({ where: { id: run.id }, data: { status: newStatus } })
        return { ...run, status: newStatus }
      }

      // Auto-fail PENDING entries stuck >10 min — but skip ones with active CCTP burns (they're legitimately in-flight)
      const ageMs = Date.now() - new Date(run.createdAt).getTime()
      if (ageMs > TEN_MIN_MS) {
        const pendingIds = run.entries.filter((e) => e.status === 'PENDING' && !e.cctpBurnCircleId).map((e) => e.id)
        if (pendingIds.length > 0) {
          await db.payrollEntry.updateMany({
            where: { id: { in: pendingIds } },
            data:  { status: 'FAILED', errorMessage: 'Timed out — use Retry to re-attempt.' },
          })
          const updatedEntries = run.entries.map((e) =>
            e.status === 'PENDING'
              ? { ...e, status: 'FAILED', errorMessage: 'Timed out — use Retry to re-attempt.' }
              : e
          )
          const completed = updatedEntries.filter((e) => e.status === 'COMPLETED').length
          const failed    = updatedEntries.filter((e) => e.status === 'FAILED').length
          const newStatus = failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL'
          await db.payrollRun.update({ where: { id: run.id }, data: { status: newStatus } })
          return { ...run, status: newStatus, entries: updatedEntries }
        }
      }

      return run
    }),
  )

  return NextResponse.json({ runs: fixedRuns })
}
