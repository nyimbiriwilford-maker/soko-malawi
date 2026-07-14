import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Session gate for protected routes.
 * Subscribes to auth changes so sign-out invalidates immediately.
 */
export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (session === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}
