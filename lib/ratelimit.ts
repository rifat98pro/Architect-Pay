import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token || !url.startsWith('https')) return null
  try {
    return new Redis({ url, token })
  } catch {
    return null
  }
}

function makeLimiter(prefix: string, window: string, limit: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter:   Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    analytics: false,
    prefix,
  })
}

// Auth routes — strict limits to block brute force / OTP spam
export const authLimiter    = makeLimiter('rl:auth',    '1 m', 5)   // 5 per minute per IP
export const otpLimiter     = makeLimiter('rl:otp',     '1 h', 3)   // 3 per hour per email
export const paymentLimiter = makeLimiter('rl:payment', '1 m', 10)  // 10 per minute per user

/** Returns a 429 response if rate limited, otherwise null. */
export async function checkRateLimit(
  limiter:    Ratelimit | null,
  identifier: string,
): Promise<NextResponse | null> {
  if (!limiter) return null // fail open if Redis not configured
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit':     String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset':     String(reset),
            'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
          },
        },
      )
    }
    return null
  } catch {
    return null
  }
}

/** Gets IP from request for use as rate limit identifier. */
export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
