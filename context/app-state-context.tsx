'use client'

import React, { createContext, useContext, useCallback, useRef, useState } from 'react'

type FeatureState = Record<string, unknown>

interface AppStateCtx {
  getFeature: <T extends FeatureState>(key: string) => T | undefined
  setFeature: (key: string, updates: FeatureState) => void
  clearFeature: (key: string) => void
}

const AppStateContext = createContext<AppStateCtx | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Record<string, FeatureState>>({})

  const getFeature = useCallback(<T extends FeatureState>(key: string): T | undefined => {
    return store[key] as T | undefined
  }, [store])

  const setFeature = useCallback((key: string, updates: FeatureState) => {
    setStore((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...updates },
    }))
  }, [])

  const clearFeature = useCallback((key: string) => {
    setStore((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return (
    <AppStateContext.Provider value={{ getFeature, setFeature, clearFeature }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
