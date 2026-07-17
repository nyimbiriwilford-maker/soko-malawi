import { useCallback, useEffect, useState } from 'react'
import { getSellerVerificationAttention } from '../lib/verification'

/**
 * Loads seller verification attention state for banners / cards.
 * Re-fetches when userId changes or refresh() is called.
 */
export default function useVerificationAttention(userId) {
  const [attention, setAttention] = useState(null)
  const [loading, setLoading] = useState(!!userId)

  const refresh = useCallback(async () => {
    if (!userId) {
      setAttention(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const data = await getSellerVerificationAttention(userId)
      setAttention(data)
      return data
    } catch {
      setAttention(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  return { attention, loading, refresh }
}
