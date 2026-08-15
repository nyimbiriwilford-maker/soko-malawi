import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateStrongPassword, validatePasswordMatch } from '../utils/validation'

/**
 * ResetPassword.jsx
 *
 * Supabase redirects the user here after they click the password-reset link
 * in their email.  The URL will contain a hash fragment with the access token
 * e.g. /#access_token=...&type=recovery
 *
 * supabase-js v2 automatically detects this and fires an onAuthStateChange
 * event with event === 'PASSWORD_RECOVERY', which sets a temporary session
 * so we can call updateUser({ password }).
 *
 * Add this route in App.jsx:
 *   <Route path="/reset-password" element={<ResetPassword />} />
 * (no auth guard — the user is not fully logged in yet)
 */
export default function ResetPassword() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [ready, setReady]         = useState(false)   // true once recovery session is active
  const [message, setMessage]     = useState({ text: '', isError: false })
  const navigate = useNavigate()

  function setError(text) { setMessage({ text, isError: true }) }
  function setInfo(text)  { setMessage({ text, isError: false }) }

  // Wait for Supabase to process the recovery token from the URL hash
  useEffect(() => {
    // supabase-js v2 parses the hash automatically on import;
    // listen for the PASSWORD_RECOVERY event which signals the session is ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // If the page was already loaded with the token (hard navigation), check
    // the current session right away.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    if (!password || !confirm) { setError('Please fill in both fields'); return }
    if (validateStrongPassword(password)) { setError(validateStrongPassword(password)); return }
    if (validatePasswordMatch(confirm, password)) { setError(validatePasswordMatch(confirm, password)); return }

    setLoading(true)
    setMessage({ text: '', isError: false })

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) { setError(error.message); return }

    setInfo('✅ Password updated! Redirecting to sign in…')

    // Sign out the temporary recovery session, then redirect to login
    await supabase.auth.signOut()
    setTimeout(() => navigate('/login'), 2000)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleReset()
  }

  return (
    <div style={styles.page}>
      <div style={styles.logoWrap}>
        <div style={styles.logo}>Soko Malawi</div>
        <p style={styles.tagline}>Buy. Sell. Find Work.</p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.title}>Set new password</h2>
        <p style={styles.sub}>
          {ready
            ? 'Choose a strong password for your account.'
            : 'Verifying your reset link…'}
        </p>

        {!ready && (
          <div style={styles.spinner}>⏳ Please wait…</div>
        )}

        {ready && (
          <>
            <input
              style={styles.input}
              type="password"
              placeholder="New password (8+ chars, uppercase, lowercase, number, special)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
            />

            {message.text && (
              <p style={message.isError ? styles.error : styles.info}>{message.text}</p>
            )}

            <button style={styles.btn} onClick={handleReset} disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </>
        )}

        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => navigate('/login')}>← Back to sign in</span>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page:    { minHeight: '100vh', background: '#0f1410', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  logoWrap:{ textAlign: 'center', marginBottom: '40px' },
  logo:    { fontSize: '32px', fontWeight: '800', color: '#5de89e', letterSpacing: '-1px' },
  tagline: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '6px' },
  card:    { background: '#fff', borderRadius: '20px', padding: '32px 24px', width: '100%', maxWidth: '400px' },
  title:   { fontSize: '22px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  sub:     { fontSize: '14px', color: '#637068', marginBottom: '24px' },
  input:   { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 14px', fontSize: '15px', outline: 'none', marginBottom: '12px', display: 'block', boxSizing: 'border-box' },
  btn:     { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
  error:   { color: '#c0392b', fontSize: '13px', marginBottom: '10px' },
  info:    { color: '#1a7a4a', fontSize: '13px', marginBottom: '10px', background: '#e6f4ec', borderRadius: '8px', padding: '10px 12px' },
  spinner: { color: '#637068', fontSize: '14px', textAlign: 'center', padding: '20px 0' },
  toggle:  { textAlign: 'center', fontSize: '13px', color: '#637068', marginTop: '16px' },
  link:    { color: '#1a7a4a', cursor: 'pointer', fontWeight: '600' },
}