import { NextRequest, NextResponse } from 'next/server'
import { getPublicMetrics } from '@/lib/metrics'
import { checkRateLimit, getIP } from '@/lib/ratelimit'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Max 30 seconds

// Dedicated public metrics rate limiter: 60 requests per minute per IP
let metricsLimiter: Ratelimit | null = null
try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token && url.startsWith('https')) {
    const redis = new Redis({ url, token })
    metricsLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: false,
      prefix: 'rl:metrics',
    })
  }
} catch {
  metricsLimiter = null
}

export async function GET(req: NextRequest) {
  // Check rate limit if configured
  if (metricsLimiter) {
    const ip = getIP(req)
    const limited = await checkRateLimit(metricsLimiter, `metrics:${ip}`)
    if (limited) return limited
  }

  // Check if force refresh is requested via query param (optional, server-side only)
  const { searchParams } = new URL(req.url)
  const refresh = searchParams.get('refresh') === 'true'

  try {
    const metrics = await getPublicMetrics(refresh)

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (err) {
    console.error('[api/public-metrics] Failed to retrieve metrics:', err)
    return NextResponse.json(
      {
        error: 'Unable to retrieve metrics at this time.',
        generatedAt: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

