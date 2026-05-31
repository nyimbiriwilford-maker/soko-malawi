import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit() {
    setError('')
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      setError('Check your email to confirm your account')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    // Check role — admin goes to /admin, everyone else goes to /
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin') {
      navigate('/admin')
    } else {
      navigate('/')
    }

    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div style={styles.page}>
      <div style={styles.logoWrap}>
        <div style={styles.logo}>Soko Malawi</div>
        <p style={styles.tagline}>Buy. Sell. Find Work.</p>
      </div>
      <div style={styles.card}>
        <h2 style={styles.title}>{isSignUp ? 'Create account' : 'Welcome back'}</h2>
        <p style={styles.sub}>{isSignUp ? 'Sign up to get started' : 'Sign in to your account'}</p>

        <input
          style={styles.input}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>

        <p style={styles.toggle}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span style={styles.link} onClick={() => { setIsSignUp(!isSignUp); setError('') }}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </span>
        </p>
      </div>
      <p style={styles.footer}>By continuing you agree to our Terms of Service</p>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#0f1410', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  logoWrap: { textAlign: 'center', marginBottom: '40px' },
  logo: { fontSize: '32px', fontWeight: '800', color: '#5de89e', letterSpacing: '-1px' },
  tagline: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '6px' },
  card: { background: '#fff', borderRadius: '20px', padding: '32px 24px', width: '100%', maxWidth: '400px' },
  title: { fontSize: '22px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  sub: { fontSize: '14px', color: '#637068', marginBottom: '24px' },
  input: { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 14px', fontSize: '15px', outline: 'none', marginBottom: '12px', display: 'block', boxSizing: 'border-box' },
  btn: { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
  error: { color: '#c0392b', fontSize: '13px', marginBottom: '10px' },
  toggle: { textAlign: 'center', fontSize: '13px', color: '#637068', marginTop: '16px' },
  link: { color: '#1a7a4a', cursor: 'pointer', fontWeight: '600' },
  footer: { color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '24px', textAlign: 'center' },
}