'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Persists form state in sessionStorage so navigation away and back
 * doesn't wipe what the user was filling in.
 * Cleared on browser tab refresh (sessionStorage semantics).
 *
 * Usage:
 *   const [form, setForm, clearForm] = useFormPersist('my-key', { name: '', salary: '' })
 *   setForm({ name: 'Alice' })   // partial update — other fields preserved
 *   clearForm()                  // call on successful submit
 */
export function useFormPersist<T extends Record<string, unknown>>(
  key: string,
  initialValues: T,
): [T, (updates: Partial<T>) => void, () => void] {
  const [values, setValues] = useState<T>(initialValues)

  // Restore from sessionStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`form:${key}`)
      if (raw) {
        const stored = JSON.parse(raw) as Partial<T>
        setValues((prev) => ({ ...prev, ...stored }))
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback((updates: Partial<T>) => {
    setValues((prev) => {
      const next = { ...prev, ...updates }
      try { sessionStorage.setItem(`form:${key}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [key])

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(`form:${key}`) } catch { /* ignore */ }
    setValues(initialValues)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [values, update, clear]
}
