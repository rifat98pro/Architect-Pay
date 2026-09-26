import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function getUserFromRequest() {
  const session = await auth()
  if (!session?.user?.email) return null
  return db.user.findUnique({ where: { email: session.user.email } })
}
