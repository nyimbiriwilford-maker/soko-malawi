import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        navigate('/', { replace: true })
      } else if (event === 'SIGNED_OUT' || !session) {
        subscription.unsubscribe()
        navigate('/login', { replace: true })
      }
    })

    // Fallback: if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#637068', fontFamily: 'sans-serif' }}>
      Signing you in…
    </div>
  )
}