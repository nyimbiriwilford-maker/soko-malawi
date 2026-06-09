import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useFollow(currentUserId, sellerId) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentUserId || !sellerId || currentUserId === sellerId) return
    supabase
      .from('seller_follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('seller_id', sellerId)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data))
  }, [currentUserId, sellerId])

  const toggle = async () => {
    if (!currentUserId || !sellerId || loading) return
    setLoading(true)
    if (following) {
      await supabase
        .from('seller_follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('seller_id', sellerId)
      setFollowing(false)
    } else {
      await supabase
        .from('seller_follows')
        .insert({ follower_id: currentUserId, seller_id: sellerId })
      setFollowing(true)
    }
    setLoading(false)
  }

  return { following, toggle, loading }
}