import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today      = new Date()
  const dayOfMonth = today.getUTCDate()

  const businesses = await db.business.findMany({
    where: { scheduledDay: dayOfMonth },
    select: { id: true, userId: true, name: true },
  })

  if (businesses.length === 0) {
    return NextResponse.json({ ran: 0, message: `No businesses scheduled for day ${dayOfMonth}` })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const results = await Promise.allSettled(
    businesses.map(async (biz) => {
      const res  = await fetch(`${baseUrl}/api/payroll/run`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'x-user-id':     biz.userId,
        },
        body: JSON.stringify({ businessId: biz.id }),
      })
      const data = await res.json()
      return { businessId: biz.id, name: biz.name, ok: res.ok, ...data }
    }),
  )

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  )

  return NextResponse.json({ ran: businesses.length, day: dayOfMonth, results: summary })
}
