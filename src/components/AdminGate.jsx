import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
const Admin = lazy(() => import('../pages/Admin'))

export default function AdminGate() {
  const navigate = useNavigate()
  const [state, setState] = useState('checking') // checking | ready | denied | redirect | error
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  useLayoutEffect(() => {
    let r1 = 0, r2 = 0
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => {
      const hide = window.__hideBootLoader
      if (typeof hide === 'function') hide()
    }) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [])

  useEffect(() => {
    let cancelled = false
    setState('checking')
    setError(null)

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Admin access check timed out')), 6000)
    )

    const check = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session?.user) return { type: 'out' }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (profileError) throw profileError
      if (profile?.role !== 'admin') return { type: 'denied' }
      return { type: 'ready', user: session.user }
    }

    Promise.race([check(), timeout])
      .then((result) => {
        if (cancelled) return
        if (result.type === 'out') {
          setState('redirect')
          navigate('/login', { replace: true })
          return
        }
        if (result.type === 'denied') {
          setState('denied')
          return
        }
        setUser(result.user)
        setState('ready')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setState('error')
      })

    return () => { cancelled = true }
  }, [navigate, retryKey])

  if (state === 'checking') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Checking admin access…</p>
      </div>
    )
  }

  if (state === 'redirect') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Redirecting to login…</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>Access denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>{error?.message || 'Unable to verify admin access.'}</p>
        <button type="button" onClick={() => setRetryKey((k) => k + 1)}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Loading admin…</div>}>
      <Admin />
    </Suspense>
  )
}