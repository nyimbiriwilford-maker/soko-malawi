import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode]               = useState('choose')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [username, setUsername]       = useState('')
  const [otpCode, setOtpCode]         = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage]         = useState({ text: '', isError: false })
  const navigate = useNavigate()

  const SUPABASE_URL = supabase.supabaseUrl

  function setError(text) { setMessage({ text, isError: true }) }
  function setInfo(text)  { setMessage({ text, isError: false }) }
  function clearMsg()     { setMessage({ text: '', isError: false }) }

  // ── Google OAuth ─────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true)
    clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://soko-malawi.vercel.app/auth/callback' },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  // ── Email Sign In ────────────────────────────────────────
  async function handleEmailSignIn() {
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true); clearMsg()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message?.toLowerCase().includes('email not confirmed')
        ? 'Please verify your email first.'
        : error.message)
      return
    }
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Please verify your email before signing in.')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    setLoading(false)
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

  // ── Email Sign Up: send OTP ──────────────────────────────
  async function handleEmailSignUp() {
    if (!email || !password) { setError('Enter email and password'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo('Verification code sent to your email.')
    setMode('verify_email')
  }

  // ── Email Sign Up: verify + set username + create ────────
  async function handleVerifyAndCreate() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    if (!username.trim()) { setError('Choose a username'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }
    setLoading(true); clearMsg()

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setLoading(false); setError(data.error || 'Invalid or expired code'); return }

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { email_verified: true, full_name: username.trim() }, emailRedirectTo: null },
    })
    if (signUpErr) { setLoading(false); setError(signUpErr.message); return }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInErr) {
      setLoading(false)
      setInfo('Account created! Check your email for a confirmation link.')
      setMode('email'); setOtpCode(''); return
    }

    // Save username to profiles and users tables
    await supabase.from('profiles').upsert({
      id: signInData.user.id,
      full_name: username.trim(),
      updated_at: new Date().toISOString(),
    })
    await supabase.from('users').upsert({ id: signInData.user.id, name: username.trim() }, { onConflict: 'id' })

    setLoading(false)
    navigate('/')
  }

  // ── Forgot ───────────────────────────────────────────────
  async function handleSendResetOtp() {
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo('Code sent to your email.')
    setMode('otp')
  }

  async function handleVerifyResetOtp() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Invalid code'); return }
    setInfo('Verified! Set your new password.')
    setMode('newpass')
  }

  async function handleSetNewPassword() {
    if (!newPass || !confirmPass) { setError('Fill in both fields'); return }
    if (newPass.length < 8)       { setError('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass)  { setError('Passwords do not match'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode, newPassword: newPass }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to update password'); return }
    setInfo('Password updated! You can now sign in.')
    setTimeout(() => { setMode('email'); clearMsg(); setOtpCode(''); setNewPass(''); setConfirmPass('') }, 2000)
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    const actions = {
      email: handleEmailSignIn,
      verify_email: handleVerifyAndCreate,
      forgot: handleSendResetOtp,
      otp: handleVerifyResetOtp,
      newpass: handleSetNewPassword,
    }
    actions[mode]?.()
  }

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes glow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        input::placeholder { color: #8fa99a; }
        input:focus { outline: none !important; border-color: #1a7a4a !important; box-shadow: 0 0 0 3px rgba(26,122,74,0.12) !important; }
        button { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        button:active { transform: scale(0.97); }
      `}</style>

      {/* Background glows */}
      <div style={s.glow1} />
      <div style={s.glow2} />

      {/* Logo */}
      <div style={s.logoArea}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#1a7a4a', letterSpacing: '-1px' }}>Soko</span>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#e6a817', letterSpacing: '-1px' }}>Mw</span>
        </div>
        <span style={s.tagline}>Buy · Sell · Find Jobs &amp; Services</span>
      </div>

      {/* Card */}
      <div style={s.card}>

        {/* Step indicator */}
        {mode !== 'choose' && (
          <div style={s.stepBar}>
            {[0,1,2].map(i => {
              const step = mode === 'email' || mode === 'forgot' ? 0 : mode === 'verify_email' || mode === 'otp' ? 1 : 2
              return <div key={i} style={{ ...s.stepDot, ...(i <= step ? s.stepDotOn : {}) }} />
            })}
          </div>
        )}

        <div style={s.body}>

          {/* ── CHOOSE ── */}
          {mode === 'choose' && <>
            <div style={{ ...s.headBlock, marginBottom: 28 }}>
              <h2 style={{ ...s.heading, fontSize: 20, fontWeight: 700 }}>Welcome back</h2>
              <p style={{ ...s.sub, fontSize: 13 }}>Choose how you'd like to continue</p>
            </div>

            <button style={s.googleBtn} onClick={handleGoogle} disabled={googleLoading}>
              {googleLoading ? <Spinner dark /> : <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </>}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#f0f0f0' }} />
              <span style={{ fontSize: 11, color: '#b0b8b4', fontWeight: 600, letterSpacing: 0.5 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#f0f0f0' }} />
            </div>

            <button style={s.emailBtn} onClick={() => { setMode('email'); clearMsg() }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Continue with Email
            </button>

            <p style={{ ...s.terms, marginTop: 20, fontSize: 11, color: '#b0b8b4' }}>
              By continuing you agree to our <span style={s.link}>Terms of Service</span>
            </p>
          </>}

          {/* ── EMAIL ── */}
          {mode === 'email' && <>
            <BackBtn onClick={() => { setMode('choose'); clearMsg() }} />
            <div style={s.headBlock}>
              <h2 style={s.heading}>Sign in</h2>
              <p style={s.sub}>Enter your credentials to continue</p>
            </div>
            <Field label="Email address">
              <input style={s.input} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
            </Field>
            <Field label="Password">
              <input style={s.input} type="password" placeholder="Min. 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} autoComplete="current-password" />
            </Field>
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 20 }}>
              <span style={s.link} onClick={() => { setMode('forgot'); clearMsg() }}>Forgot password?</span>
            </div>
            <Msg msg={message} />
            <button style={s.primaryBtn} onClick={handleEmailSignIn} disabled={loading}>
              {loading ? <Spinner /> : 'Sign In →'}
            </button>
            <button style={s.ghostBtn} onClick={handleEmailSignUp} disabled={loading}>
              {loading ? 'Sending code…' : "Don't have an account? Create one"}
            </button>
          </>}

          {/* ── VERIFY EMAIL ── */}
          {mode === 'verify_email' && <>
            <BackBtn onClick={() => { setMode('email'); clearMsg(); setOtpCode('') }} />
            <div style={s.iconBadge}>✉️</div>
            <div style={s.headBlock}>
              <h2 style={s.heading}>Check your email</h2>
              <p style={s.sub}>We sent a 6-digit code to <strong style={{ color: '#1a7a4a' }}>{email}</strong></p>
            </div>
            <Field label="Verification code">
              <input
                style={{ ...s.input, fontSize: 28, fontWeight: 800, letterSpacing: 12, textAlign: 'center', padding: '14px 10px' }}
                type="text" inputMode="numeric" maxLength={6} placeholder="······"
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
            </Field>
            <Field label="Your name">
              <input style={s.input} type="text" placeholder="e.g. James Banda"
                value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} />
            </Field>
            <p style={{ fontSize: 12, color: '#8fa99a', marginTop: -12, marginBottom: 16 }}>
              This is how other users will see you on Soko Malawi
            </p>
            <p style={s.resend}>
              Didn't get it? <span style={s.link} onClick={() => { handleEmailSignUp(); setOtpCode('') }}>Resend code</span>
            </p>
            <Msg msg={message} />
            <button style={s.primaryBtn} onClick={handleVerifyAndCreate} disabled={loading}>
              {loading ? <Spinner /> : 'Create My Account →'}
            </button>
          </>}

          {/* ── FORGOT ── */}
          {mode === 'forgot' && <>
            <BackBtn onClick={() => { setMode('email'); clearMsg() }} />
            <div style={s.iconBadge}>🔑</div>
            <div style={s.headBlock}>
              <h2 style={s.heading}>Reset password</h2>
              <p style={s.sub}>Enter your email and we'll send a reset code</p>
            </div>
            <Field label="Email address">
              <input style={s.input} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
            </Field>
            <Msg msg={message} />
            <button style={s.primaryBtn} onClick={handleSendResetOtp} disabled={loading}>
              {loading ? <Spinner /> : 'Send Reset Code'}
            </button>
          </>}

          {/* ── RESET OTP ── */}
          {mode === 'otp' && <>
            <div style={s.iconBadge}>🔐</div>
            <div style={s.headBlock}>
              <h2 style={s.heading}>Enter code</h2>
              <p style={s.sub}>Sent to <strong style={{ color: '#1a7a4a' }}>{email}</strong></p>
            </div>
            <Field label="6-digit code">
              <input
                style={{ ...s.input, fontSize: 28, fontWeight: 800, letterSpacing: 12, textAlign: 'center', padding: '14px 10px' }}
                type="text" inputMode="numeric" maxLength={6} placeholder="······"
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
            </Field>
            <p style={s.resend}>
              Didn't get it? <span style={s.link} onClick={() => { setMode('forgot'); clearMsg(); setOtpCode('') }}>Resend</span>
            </p>
            <Msg msg={message} />
            <button style={s.primaryBtn} onClick={handleVerifyResetOtp} disabled={loading}>
              {loading ? <Spinner /> : 'Verify Code'}
            </button>
          </>}

          {/* ── NEW PASSWORD ── */}
          {mode === 'newpass' && <>
            <div style={s.iconBadge}>🛡️</div>
            <div style={s.headBlock}>
              <h2 style={s.heading}>New password</h2>
              <p style={s.sub}>Choose a strong password for your account</p>
            </div>
            <Field label="New password">
              <input style={s.input} type="password" placeholder="Min. 8 characters"
                value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
            </Field>
            <Field label="Confirm password">
              <input style={s.input} type="password" placeholder="Repeat your password"
                value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
            </Field>
            <Msg msg={message} />
            <button style={s.primaryBtn} onClick={handleSetNewPassword} disabled={loading}>
              {loading ? <Spinner /> : 'Update Password'}
            </button>
          </>}

        </div>
      </div>

      {/* Bottom trust badges */}
      <div style={s.trustRow}>
        {[
          {  label: 'Secure' },
          { icon: '🇲🇼', label: 'Made for Malawi' },
          {  label: 'Free to use' },
        ].map(({ icon, label }) => (
          <div key={label} style={s.trustBadge}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3d5247' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Small helper components ──────────────────────────────────
function Spinner({ dark }) {
  return <div style={{
    width: 18, height: 18,
    border: `2.5px solid ${dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)'}`,
    borderTop: `2.5px solid ${dark ? '#1a7a4a' : '#fff'}`,
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  }} />
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', top: 20, left: 20,
      width: 34, height: 34, borderRadius: 10,
      background: '#f4f8f5', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a7a4a',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#e8ede9' }} />
      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>or</span>
      <div style={{ flex: 1, height: 1, background: '#e8ede9' }} />
    </div>
  )
}

function Msg({ msg }) {
  if (!msg?.text) return null
  return (
    <div style={{
      borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14,
      background: msg.isError ? '#fef2f2' : '#e6f4ec',
      border: `1px solid ${msg.isError ? '#fecaca' : '#b8d8c4'}`,
      color: msg.isError ? '#dc2626' : '#1a7a4a',
    }}>
      {msg.text}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px 40px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  glow1: { display: 'none' },
glow2: { display: 'none' },
  logoArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    marginBottom: 28, animation: 'fadeUp 0.5s ease both',
  },
  logoMark: { display: 'none' },
  logoText: { display: 'none' },
  tagline:  { fontSize: 12, color: '#637068', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
  card: {
    background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 400,
    boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
    animation: 'fadeUp 0.5s 0.1s ease both', overflow: 'hidden', position: 'relative',
  },
  stepBar:    { display: 'flex', gap: 6, padding: '18px 28px 0', justifyContent: 'center' },
  stepDot:    { height: 4, width: 24, borderRadius: 2, background: '#e8ede9', transition: 'all 0.3s' },
  stepDotOn:  { background: '#1a7a4a', width: 40 },
  body:       { padding: '28px 28px 32px', position: 'relative' },
  iconBadge:  { fontSize: 38, textAlign: 'center', display: 'block', marginBottom: 10, animation: 'float 3s ease-in-out infinite' },
  headBlock:  { marginBottom: 22 },
  heading:    { fontSize: 22, fontWeight: 800, color: '#0a1a0f', lineHeight: 1.2, marginBottom: 5 },
  sub:        { fontSize: 14, color: '#637068', lineHeight: 1.6 },
  input: {
    width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 12,
    padding: '13px 14px', fontSize: 15, display: 'block',
    marginBottom: 16, background: '#f8fbf9', color: '#0a1a0f',
    fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  primaryBtn: {
    width: '100%', background: 'linear-gradient(135deg, #1a7a4a 0%, #22a05e 100%)',
    color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 18px rgba(26,122,74,0.35)', marginTop: 4,
  },
  ghostBtn: {
    width: '100%', background: 'transparent', color: '#1a7a4a',
    border: '1.5px solid #d4ead9', borderRadius: 12, padding: '14px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10,
  },
  googleBtn: {
    width: '100%', background: '#fff', color: '#0a1a0f',
    border: '1.5px solid #e8e8e8', borderRadius: 12, padding: '13px 16px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  },
  emailBtn: {
    width: '100%', background: '#1a7a4a', color: '#fff',
    border: 'none', borderRadius: 12, padding: '13px 16px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    transition: 'opacity 0.2s',
  },
  link:     { color: '#1a7a4a', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  resend:   { fontSize: 13, color: '#637068', textAlign: 'center', marginBottom: 14 },
  terms:    { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 },
  trustRow: {
    display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center',
    animation: 'fadeUp 0.5s 0.3s ease both',
  },
  trustBadge: {
    fontSize: 11, color: '#637068', background: '#fff',
    borderRadius: 20, padding: '5px 12px', border: '1px solid #e0ebe3',
  },
}