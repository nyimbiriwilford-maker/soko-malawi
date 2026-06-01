import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// modes: 'choose' | 'email' | 'phone' | 'phone_otp' | 'phone_pass' | 'forgot' | 'otp' | 'newpass'
export default function Login() {
  const [mode, setMode]             = useState('choose')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [otpCode, setOtpCode]       = useState('')
  const [newPass, setNewPass]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [identifier, setIdentifier] = useState('') // for reset flow
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage]       = useState({ text: '', isError: false })
  const navigate = useNavigate()

  const SUPABASE_URL = supabase.supabaseUrl

  function setError(text) { setMessage({ text, isError: true }) }
  function setInfo(text)  { setMessage({ text, isError: false }) }
  function clearMsg()     { setMessage({ text: '', isError: false }) }

  function normalisePhone(raw) {
    let p = raw.trim().replace(/[\s\-]/g, '')
    if (!p.startsWith('+')) p = '+265' + p.replace(/^0/, '')
    return p
  }

  // ── Google OAuth ─────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true)
    clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://soko-malawi.vercel.app',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  // ── Phone: Send OTP ──────────────────────────────────────
  async function handleSendPhoneOtp() {
    if (!phone.trim()) { setError('Enter your phone number'); return }
    setLoading(true); clearMsg()

    const formatted = normalisePhone(phone)

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ identifier: formatted }),
    })

    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo('✅ Code sent via SMS. Enter it below.')
    setMode('phone_otp')
  }

  // ── Phone: Verify OTP ────────────────────────────────────
  async function handleVerifyPhoneOtp() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); clearMsg()

    const formatted = normalisePhone(phone)

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ identifier: formatted, code: otpCode }),
    })

    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Invalid code'); return }
    setInfo('✅ Phone verified! Now set a password.')
    setMode('phone_pass')
  }

  // ── Phone: Set password + create account ─────────────────
  async function handlePhoneSetPassword() {
    if (!newPass || !confirmPass)  { setError('Fill in both fields'); return }
    if (newPass.length < 8)        { setError('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass)    { setError('Passwords do not match'); return }
    setLoading(true); clearMsg()

    const formatted = normalisePhone(phone)
    const fakeEmail = `${formatted.replace('+', '')}@sokomw.app`

    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password: newPass,
      options: {
        data: { phone: formatted, signup_method: 'phone' },
        emailRedirectTo: null,
      },
    })

    if (error) { setError(error.message); setLoading(false); return }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: newPass,
    })

    setLoading(false)
    if (signInErr) { setError(signInErr.message); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', signInData.user.id).single()
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

  // ── Email Sign In ────────────────────────────────────────
  async function handleEmailSignIn() {
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true); clearMsg()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message?.toLowerCase().includes('email not confirmed')
        ? 'Please verify your email first. Check your inbox.'
        : error.message)
      return
    }
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Please verify your email before signing in.')
      return
    }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single()
    setLoading(false)
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

  // ── Email Sign Up ────────────────────────────────────────
  async function handleEmailSignUp() {
    if (!email || !password) { setError('Enter email and password'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); clearMsg()

    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setInfo('✅ Check your email to confirm your account.')
    setMode('email')
    setPassword('')
  }

  // ── Forgot: send OTP ─────────────────────────────────────
  async function handleSendResetOtp() {
    if (!identifier.trim()) { setError('Enter your phone or email'); return }
    setLoading(true); clearMsg()

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ identifier: identifier.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo(`✅ Code sent via ${data.method === 'sms' ? 'SMS' : 'email'}.`)
    setMode('otp')
  }

  // ── Forgot: verify OTP ───────────────────────────────────
  async function handleVerifyResetOtp() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); clearMsg()

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ identifier: identifier.trim(), code: otpCode }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Invalid code'); return }
    setInfo('✅ Verified! Set your new password.')
    setMode('newpass')
  }

  // ── Forgot: set new password ─────────────────────────────
  async function handleSetNewPassword() {
    if (!newPass || !confirmPass) { setError('Fill in both fields'); return }
    if (newPass.length < 8)       { setError('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass)  { setError('Passwords do not match'); return }
    setLoading(true); clearMsg()

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ identifier: identifier.trim(), code: otpCode, newPassword: newPass }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to update password'); return }
    setInfo('✅ Password updated! Signing you in…')
    setTimeout(() => { setMode('choose'); clearMsg(); setOtpCode(''); setNewPass(''); setConfirmPass('') }, 2000)
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    const actions = {
      email:      handleEmailSignIn,
      phone:      handleSendPhoneOtp,
      phone_otp:  handleVerifyPhoneOtp,
      phone_pass: handlePhoneSetPassword,
      forgot:     handleSendResetOtp,
      otp:        handleVerifyResetOtp,
      newpass:    handleSetNewPassword,
    }
    actions[mode]?.()
  }

  return (
    <div style={s.page}>
      <div style={s.logoWrap}>
        <div style={s.logo}>Soko Malawi</div>
        <p style={s.tagline}>Buy. Sell. Find Work.</p>
      </div>

      <div style={s.card}>

        {/* ── CHOOSE screen ── */}
        {mode === 'choose' && <>
          <h2 style={s.title}>Welcome</h2>
          <p style={s.sub}>Sign in or create an account</p>

          <button style={s.googleBtn} onClick={handleGoogle} disabled={googleLoading}>
            {googleLoading ? 'Redirecting…' : <>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 10, flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </>}
          </button>

          <div style={s.divider}><span style={s.dividerText}>or</span></div>

          <button style={s.optionBtn} onClick={() => { setMode('phone'); clearMsg() }}>
            <span style={s.optionIcon}>📱</span> Continue with Phone Number
          </button>

          <button style={{ ...s.optionBtn, marginTop: 10 }} onClick={() => { setMode('email'); clearMsg() }}>
            <span style={s.optionIcon}>✉️</span> Continue with Email
          </button>

          <p style={s.footer2}>By continuing you agree to our Terms of Service</p>
        </>}

        {/* ── EMAIL screen ── */}
        {mode === 'email' && <>
          <h2 style={s.title}>Email</h2>
          <p style={s.sub}>Sign in or create an account</p>
          <input style={s.input} type="email" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
          <input style={s.input} type="password" placeholder="Password (min. 8 characters)"
            value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} autoComplete="current-password" />
          <p style={s.forgotWrap}>
            <span style={s.link} onClick={() => { setMode('forgot'); clearMsg() }}>Forgot password?</span>
          </p>
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleEmailSignIn} disabled={loading}>
            {loading ? 'Please wait…' : 'Sign In'}
          </button>
          <button style={s.ghostBtn} onClick={handleEmailSignUp} disabled={loading}>
            Create account with Email
          </button>
          <p style={s.toggle}>
            <span style={s.link} onClick={() => { setMode('choose'); clearMsg() }}>← Other sign in options</span>
          </p>
        </>}

        {/* ── PHONE: enter number ── */}
        {mode === 'phone' && <>
          <h2 style={s.title}>Phone number</h2>
          <p style={s.sub}>We'll send a verification code via SMS</p>
          <div style={s.phoneRow}>
            <div style={s.flagBox}>🇲🇼 +265</div>
            <input style={{ ...s.input, marginBottom: 0, flex: 1 }}
              type="tel" placeholder="0999 123 456"
              value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={handleKeyDown} autoComplete="tel" />
          </div>
          <div style={{ height: 12 }} />
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleSendPhoneOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send Code'}
          </button>
          <p style={s.toggle}>
            <span style={s.link} onClick={() => { setMode('choose'); clearMsg() }}>← Other sign in options</span>
          </p>
        </>}

        {/* ── PHONE OTP ── */}
        {mode === 'phone_otp' && <>
          <h2 style={s.title}>Enter code</h2>
          <p style={s.sub}>Sent to {normalisePhone(phone)}</p>
          <input
            style={{ ...s.input, fontSize: '28px', fontWeight: '800', letterSpacing: '10px', textAlign: 'center' }}
            type="text" inputMode="numeric" maxLength={6} placeholder="000000"
            value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown} autoComplete="one-time-code" />
          <p style={s.resendWrap}>
            Didn't get it?{' '}
            <span style={s.link} onClick={() => { setMode('phone'); clearMsg(); setOtpCode('') }}>Resend</span>
          </p>
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleVerifyPhoneOtp} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
        </>}

        {/* ── PHONE SET PASSWORD ── */}
        {mode === 'phone_pass' && <>
          <h2 style={s.title}>Set password</h2>
          <p style={s.sub}>Create a password for your account</p>
          <input style={s.input} type="password" placeholder="Password (min. 8 characters)"
            value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
          <input style={s.input} type="password" placeholder="Confirm password"
            value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handlePhoneSetPassword} disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </>}

        {/* ── FORGOT: enter identifier ── */}
        {mode === 'forgot' && <>
          <h2 style={s.title}>Reset password</h2>
          <p style={s.sub}>Enter your phone number or email</p>
          <input style={s.input} type="text" placeholder="Phone number or email"
            value={identifier} onChange={e => setIdentifier(e.target.value)} onKeyDown={handleKeyDown} autoComplete="off" />
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleSendResetOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send Code'}
          </button>
          <p style={s.toggle}>
            <span style={s.link} onClick={() => { setMode('choose'); clearMsg() }}>← Back</span>
          </p>
        </>}

        {/* ── RESET OTP ── */}
        {mode === 'otp' && <>
          <h2 style={s.title}>Enter code</h2>
          <p style={s.sub}>Sent to {identifier}</p>
          <input
            style={{ ...s.input, fontSize: '28px', fontWeight: '800', letterSpacing: '10px', textAlign: 'center' }}
            type="text" inputMode="numeric" maxLength={6} placeholder="000000"
            value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown} autoComplete="one-time-code" />
          <p style={s.resendWrap}>
            Didn't get it?{' '}
            <span style={s.link} onClick={() => { setMode('forgot'); clearMsg(); setOtpCode('') }}>Resend</span>
          </p>
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleVerifyResetOtp} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
        </>}

        {/* ── NEW PASSWORD ── */}
        {mode === 'newpass' && <>
          <h2 style={s.title}>New password</h2>
          <p style={s.sub}>Choose a strong new password</p>
          <input style={s.input} type="password" placeholder="New password (min. 8 characters)"
            value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
          <input style={s.input} type="password" placeholder="Confirm new password"
            value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
          {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
          <button style={s.btn} onClick={handleSetNewPassword} disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </>}

      </div>
    </div>
  )
}

function normalisePhone(raw = '') {
  let p = raw.trim().replace(/[\s\-]/g, '')
  if (!p.startsWith('+')) p = '+265' + p.replace(/^0/, '')
  return p
}

const s = {
  page:       { minHeight: '100vh', background: '#0f1410', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif" },
  logoWrap:   { textAlign: 'center', marginBottom: '32px' },
  logo:       { fontSize: '32px', fontWeight: '800', color: '#5de89e', letterSpacing: '-1px' },
  tagline:    { color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '6px' },
  card:       { background: '#fff', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px' },
  title:      { fontSize: '22px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  sub:        { fontSize: '14px', color: '#637068', marginBottom: '24px' },
  input:      { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 14px', fontSize: '15px', outline: 'none', marginBottom: '12px', display: 'block', boxSizing: 'border-box' },
  btn:        { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
  ghostBtn:   { width: '100%', background: 'none', color: '#1a7a4a', border: '1.5px solid #1a7a4a', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' },
  googleBtn:  { width: '100%', background: '#fff', color: '#0f1410', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '13px 16px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  optionBtn:  { width: '100%', background: '#f7f8f6', color: '#0f1410', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '13px 16px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 },
  optionIcon: { fontSize: '20px' },
  divider:    { display: 'flex', alignItems: 'center', margin: '16px 0', gap: 10 },
  dividerText:{ fontSize: '13px', color: '#aaa', background: '#fff', padding: '0 8px', whiteSpace: 'nowrap' },
  error:      { color: '#c0392b', fontSize: '13px', marginBottom: '10px' },
  info:       { color: '#1a7a4a', fontSize: '13px', marginBottom: '10px', background: '#e6f4ec', borderRadius: '8px', padding: '10px 12px' },
  forgotWrap: { textAlign: 'right', marginTop: '-4px', marginBottom: '12px' },
  resendWrap: { textAlign: 'center', fontSize: '13px', color: '#637068', marginBottom: '8px' },
  toggle:     { textAlign: 'center', fontSize: '13px', color: '#637068', marginTop: '16px' },
  link:       { color: '#1a7a4a', cursor: 'pointer', fontWeight: '600' },
  footer2:    { textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '20px' },
  phoneRow:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 },
  flagBox:    { background: '#f7f8f6', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 10px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#0f1410' },
}