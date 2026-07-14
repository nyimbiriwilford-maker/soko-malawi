import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth / magic-link callback.
 * Validates session, fails closed for disabled accounts, no open redirects.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    let cancelled = false
    let finished = false

    async function finish(session) {
      if (finished || cancelled) return
      finished = true

      if (!session?.user?.id) {
        navigate('/login', { replace: true })
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_disabled')
        .eq('id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        // New OAuth users may not have a profile row yet
        navigate('/', { replace: true })
        return
      }

      if (profile?.is_disabled) {
        await supabase.auth.signOut()
        setStatus('Account unavailable')
        navigate('/login?disabled=1', { replace: true })
        return
      }

      // Safe internal paths only — never use query-string redirects
      const next = profile?.role === 'admin' ? '/admin' : '/'
      navigate(next, { replace: true })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await finish(session)
      } else if (event === 'SIGNED_OUT') {
        if (!cancelled && !finished) navigate('/login', { replace: true })
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session)
    })

    const t = window.setTimeout(() => {
      if (!cancelled && !finished) {
        setStatus('Taking longer than expected…')
        navigate('/login', { replace: true })
      }
    }, 15000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(t)
    }
  }, [navigate])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#637068',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 15,
      }}
      role="status"
      aria-live="polite"
    >
      {status}
    </div>
  )
}
