'use client'

import { useCallback } from 'react'
import { useAppState } from '@/context/app-state-context'

/**
 * Persists any feature's temporary UI state in-memory across navigation.
 * Resets on browser tab refresh (intentional).
 *
 * Usage:
 *   const [state, setState, clearState] = useFeatureState('payments', { amount: '', chain: 'ARC-TESTNET' })
 *   setState({ amount: '50' })   // partial update — other fields preserved
 *   clearState()                 // call on successful submit / intentional reset
 */
export function useFeatureState<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
): [T, (updates: Partial<T>) => void, () => void] {
  const { getFeature, setFeature, clearFeature } = useAppState()

  const stored  = getFeature<T>(key)
  const values  = stored ? ({ ...defaults, ...stored } as T) : defaults

  const update = useCallback((updates: Partial<T>) => {
    setFeature(key, updates as FeatureState)
  }, [key, setFeature])

  const reset = useCallback(() => {
    clearFeature(key)
  }, [key, clearFeature])

  return [values, update, reset]
}

type FeatureState = Record<string, unknown>
