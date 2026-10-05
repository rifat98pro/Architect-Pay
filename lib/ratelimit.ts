import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Auth routes — strict limits to block brute force / OTP spam
export const authLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(5, '1 m'),  // 5 per minute per IP
  analytics: false,
  prefix:    'rl:auth',
})

// OTP email — prevent email spam
export const otpLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(3, '1 h'),  // 3 per hour per email
  analytics: false,
  prefix:    'rl:otp',
})

// Payment routes — per user
export const paymentLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(10, '1 m'), // 10 per minute per user
  analytics: false,
  prefix:    'rl:payment',
})

/** Returns a 429 response if rate limited, otherwise null. */
export async function checkRateLimit(
  limiter:    Ratelimit,
  identifier: string,
): Promise<NextResponse | null> {
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
    // If Redis is unavailable, fail open — don't block legitimate requests
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
