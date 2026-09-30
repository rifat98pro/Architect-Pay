'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'architect_pay_pending'

interface PendingPaymentsContextType {
  addPending: (paymentId: string) => void
  pendingIds: string[]
}

const PendingPaymentsContext = createContext<PendingPaymentsContextType>({
  addPending: () => {},
  pendingIds: [],
})

export function usePendingPayments() {
  return useContext(PendingPaymentsContext)
}

function loadFromStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveToStorage(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch {}
}

export function PendingPaymentsProvider({ children }: { children: React.ReactNode }) {
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef                  = useRef<string[]>([])
  pendingRef.current                = pendingIds

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored.length) setPendingIds(stored)
  }, [])

  // Persist to localStorage whenever pendingIds changes
  useEffect(() => {
    saveToStorage(pendingIds)
  }, [pendingIds])

  // Poll all pending payments every 10s
  useEffect(() => {
    const poll = async () => {
      const ids = pendingRef.current
      if (!ids.length) return

      const completed: string[] = []

      await Promise.allSettled(
        ids.map(async (id) => {
          try {
            const res  = await fetch(`/api/payments/${id}/mint`, { method: 'POST' })
            const data = await res.json()
            if (data.status === 'COMPLETED' || data.status === 'FAILED') {
              completed.push(id)
            }
          } catch {}
        }),
      )

      if (completed.length) {
        setPendingIds((prev) => prev.filter((id) => !completed.includes(id)))
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function addPending(paymentId: string) {
    setPendingIds((prev) => prev.includes(paymentId) ? prev : [...prev, paymentId])
  }

  return (
    <PendingPaymentsContext.Provider value={{ addPending, pendingIds }}>
      {children}
    </PendingPaymentsContext.Provider>
  )
}
