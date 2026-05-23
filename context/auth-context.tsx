'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string
  name: string | null
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
