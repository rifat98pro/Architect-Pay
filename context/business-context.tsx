'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface Business { id: string; name: string }

interface BusinessContextValue {
  businesses:    Business[]
  selectedId:    string | null
  selected:      Business | null
  setSelectedId: (id: string | null) => void
  refresh:       () => Promise<void>
  loading:       boolean
}

const BusinessContext = createContext<BusinessContextValue>({
  businesses: [], selectedId: null, selected: null,
  setSelectedId: () => {}, refresh: async () => {}, loading: true,
})

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch('/api/businesses')
      const data = await res.json()
      setBusinesses(data.businesses ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    refresh().finally(() => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedBusinessId') : null
      if (saved) setSelectedIdState(saved)
      setLoading(false)
    })
  }, [refresh])

  function setSelectedId(id: string | null) {
    setSelectedIdState(id)
    if (id) localStorage.setItem('selectedBusinessId', id)
    else localStorage.removeItem('selectedBusinessId')
  }

  const selected = businesses.find((b) => b.id === selectedId) ?? null

  return (
    <BusinessContext.Provider value={{ businesses, selectedId, selected, setSelectedId, refresh, loading }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() { return useContext(BusinessContext) }
