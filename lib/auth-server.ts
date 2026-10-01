import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function getUserFromRequest() {
  const session = await auth()
  if (!session?.user) return null
  const id    = session.user.id
  const email = session.user.email
  if (id)    return db.user.findUnique({ where: { id } })
  if (email) return db.user.findUnique({ where: { email } })
  return null
}
