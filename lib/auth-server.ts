import { getSessionToken, verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

export async function getUserFromRequest(request?: Request) {
  // Try cookie first (server components / API routes with cookies)
  const cookieToken = getSessionToken()
  if (cookieToken) {
    const payload = verifyToken(cookieToken)
    if (payload) {
      return db.user.findUnique({ where: { id: payload.userId } })
    }
  }

  // Fallback: Bearer token in Authorization header
  if (request) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7))
      if (payload) {
        return db.user.findUnique({ where: { id: payload.userId } })
      }
    }
  }

  return null
}
