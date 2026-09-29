'use client'

import { SessionProvider, useSession, signOut } from 'next-auth/react'

interface AuthUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>{children}</SessionProvider>
}

export function useAuth(): AuthContextValue {
  const { data: session, status, update } = useSession()

  return {
    user: session?.user
      ? {
          id:    (session.user as any).id ?? '',
          name:  session.user.name  ?? null,
          email: session.user.email ?? '',
          image: session.user.image ?? null,
        }
      : null,
    loading: status === 'loading',
    logout:  () => signOut({ callbackUrl: '/login' }),
    refresh: () => update().then(() => {}),
  }
}
