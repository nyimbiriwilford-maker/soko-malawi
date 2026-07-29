import NM from '../lib/NetworkManager'

const NETWORK_ERROR_PATTERNS = [
  'network',
  'fetch',
  'failed to fetch',
  'timeout',
  'abort',
  'enotfound',
  'econnrefused',
  'econnreset',
  'etimedout',
  'dns',
]

const GENERIC_NETWORK_MESSAGE =
  'Network error. Please check your connection and try again.'
const OFFLINE_MESSAGE = 'You are offline. Please check your connection.'

/** Returns true if an error looks like a connectivity problem. */
export function isNetworkError(err) {
  if (!err) return false
  const text = `${err.name || ''} ${err.message || ''}`.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((p) => text.includes(p))
}

/** Turns a raw error into a safe, human-readable message. */
export function sanitizeNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return OFFLINE_MESSAGE
  }
  if (isNetworkError(err)) {
    return GENERIC_NETWORK_MESSAGE
  }
  return err?.message || 'Something went wrong. Please try again.'
}

/**
 * Wraps an async function: checks offline state before calling,
 * and routes any thrown error through the error callback.
 */
export function withNetworkCheck(fn, onError) {
  return async (...args) => {
    if (NM.isOffline) {
      const err = new Error(OFFLINE_MESSAGE)
      onError?.(err)
      throw err
    }
    try {
      return await fn(...args)
    } catch (err) {
      if (isNetworkError(err)) {
        onError?.(err)
      }
      throw err
    }
  }
}
