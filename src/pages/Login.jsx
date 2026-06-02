import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// modes: 'choose' | 'verify_email' | 'forgot' | 'otp' | 'newpass'
export default function Login() {
  const [mode, setMode]               = useState('choose')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [otpCode, setOtpCode]         = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage]         = useState({ text: '', isError: false })
  const [googleUser, setGoogleUser]   = useState(null)
  const navigate = useNavigate()

  const SUPABASE_URL = supabase.supabaseUrl

  function setError(text) { setMessage({ text, isError: true }) }
  function setInfo(text)  { setMessage({ text, isError: false }) }
  function clearMsg()     { setMessage({ text: '', isError: false }) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user
      if (user?.app_metadata?.provider === 'google') {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || ''
        const em = user.email || ''
        const avatar = user.user_metadata?.avatar_url || ''
        const initial = name?.[0]?.toUpperCase() || em?.[0]?.toUpperCase() || 'G'
        setGoogleUser({ name: name.split(' ')[0], email: em, avatar, initial })
      }
    })
  }, [])

  async function handleGoogle() {
    setGoogleLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://soko-malawi.vercel.app/auth/callback' },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleEmailSignIn() {
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true); clearMsg()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message?.toLowerCase().includes('email not confirmed')
        ? 'Please verify your email first.' : error.message)
      return
    }
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut(); setLoading(false)
      setError('Please verify your email before signing in.'); return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    setLoading(false)
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

  async function handleEmailSignUp() {
    if (!email || !password) { setError('Enter email and password'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send verification code'); return }
    setInfo('Verification code sent to your email.')
    setMode('verify_email')
  }

  async function handleVerifyAndCreate() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setLoading(false); setError(data.error || 'Invalid or expired code'); return }
    const { error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { email_verified: true }, emailRedirectTo: null },
    })
    if (signUpErr) { setLoading(false); setError(signUpErr.message); return }
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (signInErr) { setInfo('Account created! Sign in to continue.'); setMode('choose'); setOtpCode(''); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', signInData.user.id).single()
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

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
    setInfo('Reset code sent to your email.')
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
    if (newPass.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass) { setError('Passwords do not match'); return }
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
    setTimeout(() => { setMode('choose'); clearMsg(); setOtpCode(''); setNewPass(''); setConfirmPass('') }, 2000)
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    const actions = { choose: handleEmailSignIn, verify_email: handleVerifyAndCreate, forgot: handleSendResetOtp, otp: handleVerifyResetOtp, newpass: handleSetNewPassword }
    actions[mode]?.()
  }

  const BackBtn = ({ to, extra }) => (
    <span style={s.back} onClick={() => { setMode(to); clearMsg(); extra?.() }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      Back
    </span>
  )

  const Spinner = () => <span style={s.spinner} />

  return (
    <>
      <style>{`
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .lp-input:focus { border-color: #2e7d32 !important; box-shadow: 0 0 0 3px rgba(46,125,50,0.1) !important; background: #fff !important; }
        .lp-google-btn:hover:not(:disabled) { border-color: #bdbdbd !important; box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important; }
        .lp-sign-btn:hover:not(:disabled) { background: #1b5e20 !important; }
        .lp-link:hover { text-decoration: underline; }
      `}</style>

      <div style={s.page}>
        <div style={s.card}>

          {/* ── LOGO ── */}
          <div style={s.logoWrap}>
            <div style={s.logoPill}>
              <span style={s.logoSoko}>Soko</span>
              <span style={s.logoMw}>Mw</span>
            </div>
          </div>

          {/* ── CHOOSE (main screen) ── */}
          {mode === 'choose' && <>
            <h2 style={s.title}>Welcome back</h2>
            <p style={s.sub}>Sign in to your account</p>

            <button className="lp-google-btn" style={s.googleBtn} onClick={handleGoogle} disabled={googleLoading}>
              {googleUser ? (
                <>
                  <div style={s.avatar}>
                    {googleUser.avatar
                      ? <img src={googleUser.avatar} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} />
                      : googleUser.initial
                    }
                  </div>
                  <div style={s.googleInfo}>
                    <div style={s.googleName}>{googleLoading ? 'Redirecting…' : `Sign in as ${googleUser.name}`}</div>
                    <div style={s.googleEmail}>{googleUser.email}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={s.googleIconWrap}>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  </div>
                  <div style={s.googleInfo}>
                    <div style={s.googleName}>{googleLoading ? 'Redirecting…' : 'Continue with Google'}</div>
                    <div style={s.googleEmail}>Fast &amp; secure sign in</div>
                  </div>
                </>
              )}
              <span style={s.googleG}>G</span>
            </button>

            <div style={s.divider}>
              <div style={s.dividerLine}/>
              <span style={s.dividerText}>or sign in with email</span>
              <div style={s.dividerLine}/>
            </div>

            <input className="lp-input" style={s.input} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
            <input className="lp-input" style={s.input} type="password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} autoComplete="current-password" />

            {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}

            <button className="lp-sign-btn" style={s.signBtn} onClick={handleEmailSignIn} disabled={loading}>
              {loading ? 'Please wait…' : 'Sign In'}
            </button>

            <p style={s.footerRow}>Don't have an account? <span className="lp-link" style={{...s.link, fontSize:13}} onClick={handleEmailSignUp}>Register</span></p>
            <p style={{textAlign:'center', marginTop:10, fontSize:13, color:'#999'}}>
              <span className="lp-link" style={s.link} onClick={() => { setMode('forgot'); clearMsg() }}>Forgot password?</span>
            </p>
            <p style={s.footer}>By continuing you agree to our <span style={s.link}>Terms of Service</span></p>
          </>}

          {/* ── VERIFY EMAIL ── */}
          {mode === 'verify_email' && <>
            <BackBtn to="choose" extra={() => setOtpCode('')} />
            <h2 style={s.title}>Verify your email</h2>
            <p style={s.sub}>We sent a 6-digit code to<br/><strong style={{color:'#1a1a1a'}}>{email}</strong></p>
            <input className="lp-input" style={{...s.input, fontSize:28, fontWeight:700, letterSpacing:12, textAlign:'center'}}
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
            <p style={s.resend}>Didn't get it? <span className="lp-link" style={s.link} onClick={() => { handleEmailSignUp(); setOtpCode('') }}>Resend code</span></p>
            {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
            <button className="lp-sign-btn" style={s.signBtn} onClick={handleVerifyAndCreate} disabled={loading}>
              {loading ? <><Spinner /> Creating account…</> : 'Verify & Create Account'}
            </button>
          </>}

          {/* ── FORGOT ── */}
          {mode === 'forgot' && <>
            <BackBtn to="choose" />
            <h2 style={s.title}>Reset password</h2>
            <p style={s.sub}>Enter your email to receive a reset code</p>
            <input className="lp-input" style={s.input} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
            {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
            <button className="lp-sign-btn" style={s.signBtn} onClick={handleSendResetOtp} disabled={loading}>
              {loading ? <><Spinner /> Sending…</> : 'Send Reset Code'}
            </button>
          </>}

          {/* ── OTP ── */}
          {mode === 'otp' && <>
            <BackBtn to="forgot" extra={() => setOtpCode('')} />
            <h2 style={s.title}>Enter code</h2>
            <p style={s.sub}>Sent to <strong style={{color:'#1a1a1a'}}>{email}</strong></p>
            <input className="lp-input" style={{...s.input, fontSize:28, fontWeight:700, letterSpacing:12, textAlign:'center'}}
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown} autoComplete="one-time-code" />
            <p style={s.resend}>Didn't get it? <span className="lp-link" style={s.link} onClick={() => { setMode('forgot'); clearMsg(); setOtpCode('') }}>Resend</span></p>
            {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
            <button className="lp-sign-btn" style={s.signBtn} onClick={handleVerifyResetOtp} disabled={loading}>
              {loading ? <><Spinner /> Verifying…</> : 'Verify Code'}
            </button>
          </>}

          {/* ── NEW PASSWORD ── */}
          {mode === 'newpass' && <>
            <h2 style={s.title}>New password</h2>
            <p style={s.sub}>Choose a strong new password</p>
            <input className="lp-input" style={s.input} type="password" placeholder="New password (min. 8 characters)"
              value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
            <input className="lp-input" style={s.input} type="password" placeholder="Confirm new password"
              value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
            {message.text && <p style={message.isError ? s.error : s.info}>{message.text}</p>}
            <button className="lp-sign-btn" style={s.signBtn} onClick={handleSetNewPassword} disabled={loading}>
              {loading ? <><Spinner /> Updating…</> : 'Update Password'}
            </button>
          </>}

        </div>
      </div>
    </>
  )
}

const s = {
  page:          { minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'Arial','Helvetica Neue',sans-serif" },
  card:          { background: '#fff', borderRadius: '24px', border: '0.5px solid #e0e0e0', padding: '44px 40px', width: '100%', maxWidth: '420px' },
  logoWrap:      { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  logoPill:      { border: '1.5px solid #e0e0e0', borderRadius: '50px', padding: '7px 22px', display: 'inline-flex', alignItems: 'center', gap: 1 },
  logoSoko:      { fontSize: 20, fontWeight: 700, color: '#2e7d32', letterSpacing: '-0.5px' },
  logoMw:        { fontSize: 20, fontWeight: 700, color: '#f9a825', letterSpacing: '-0.5px' },
  title:         { fontSize: 22, fontWeight: 700, color: '#1a1a1a', textAlign: 'center', marginBottom: 6 },
  sub:           { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 26, lineHeight: 1.5 },
  googleBtn:     { display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #e0e0e0', borderRadius: '50px', padding: '10px 18px', cursor: 'pointer', marginBottom: 22, background: '#fff', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s' },
  avatar:        { width: 32, height: 32, borderRadius: '50%', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  googleIconWrap:{ width: 32, height: 32, borderRadius: '50%', background: '#f1f8f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  googleInfo:    { flex: 1, textAlign: 'left' },
  googleName:    { fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 },
  googleEmail:   { fontSize: 12, color: '#999', lineHeight: 1.3 },
  googleG:       { fontSize: 18, fontWeight: 700, color: '#4285f4', flexShrink: 0, fontFamily: 'Arial, sans-serif' },
  divider:       { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 },
  dividerLine:   { flex: 1, height: '0.5px', background: '#e8e8e8' },
  dividerText:   { fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' },
  input:         { width: '100%', border: '0.5px solid #e8e8e8', borderRadius: '50px', padding: '13px 20px', fontSize: 14, color: '#1a1a1a', marginBottom: 12, outline: 'none', background: '#fafafa', fontFamily: "'Arial',sans-serif", transition: 'border-color 0.15s, box-shadow 0.15s', display: 'block', boxSizing: 'border-box' },
  signBtn:       { width: '100%', padding: '14px', border: 'none', borderRadius: '50px', background: '#2e7d32', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: "'Arial',sans-serif", letterSpacing: '0.3px', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  link:          { color: '#2e7d32', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' },
  resend:        { textAlign: 'center', fontSize: 13, color: '#999', marginBottom: 10 },
  back:          { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 13, cursor: 'pointer', marginBottom: 20 },
  footer:        { textAlign: 'center', marginTop: 20, fontSize: 12, color: '#999' },
  footerRow:     { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#999' },
  error:         { color: '#c0392b', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#fdf2f2', borderRadius: 10, border: '1px solid #f5c6c6' },
  info:          { color: '#2e7d32', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#f1f8f1', borderRadius: 10, border: '1px solid #c3dfc9' },
  spinner:       { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'lp-spin 0.6s linear infinite', display: 'inline-block', verticalAlign: 'middle' },
}