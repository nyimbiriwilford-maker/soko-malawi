import { useCallback, useState } from 'react'
import { useNetwork } from '../context/NetworkContext'
import { isNetworkError, sanitizeNetworkError } from '../utils/networkError'
import NM from '../lib/NetworkManager'

/**
 * useNetworkError()
 * run(fn, { onSuccess, onError }) — checks offline state first, catches
 * network errors, and surfaces a human-readable message via `error`.
 */
export function useNetworkError() {
  const { isOffline } = useNetwork()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const clearError = useCallback(() => setError(null), [])

  const run = useCallback(
    async (fn, { onSuccess, onError, queueOnOffline = false } = {}) => {
      setError(null)

      if (isOffline) {
        const message = 'You are offline. Please check your connection.'
        setError(message)
        if (queueOnOffline) {
          NM.enqueue(() => run(fn, { onSuccess, onError }))
        }
        onError?.(new Error(message))
        return null
      }

      setLoading(true)
      try {
        const result = await fn()
        onSuccess?.(result)
        return result
      } catch (err) {
        const message = sanitizeNetworkError(err)
        setError(message)
        onError?.(err)
        if (queueOnOffline && isNetworkError(err)) {
          NM.enqueue(() => run(fn, { onSuccess, onError }))
        }
        return null
      } finally {
        setLoading(false)
      }
    },
    [isOffline]
  )

  return { error, loading, run, clearError }
}
