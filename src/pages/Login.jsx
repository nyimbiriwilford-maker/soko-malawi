import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, ArrowRight, ArrowLeft, KeyRound, ShieldCheck, MailCheck,
  Car, Smartphone, Home as HomeIcon, Briefcase, Wrench, Loader2,
  Lock, Check,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Brand palette ────────────────────────────────────────────
const C = {
  green:     '#15803D',
  greenDark: '#0F5A2C',
  greenSoft: '#22A05E',
  gold:      '#D4A017',
  goldSoft:  '#E6B93A',
  bg:        '#FAFAF8',
  dark:      '#1A1A1A',
  muted:     '#6B7280',
  line:      '#E7E5E0',
}

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
  const [success, setSuccess]         = useState(false)
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
    setSuccess(true)
    setTimeout(() => navigate(profile?.role === 'admin' ? '/admin' : '/'), 900)
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

    const { error: signUpErr } = await supabase.auth.signUp({
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

    setSuccess(true)
    setTimeout(() => navigate('/'), 900)
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
      <style>{styleTag}</style>

      {/* ════════ LEFT — Brand / marketing panel ════════ */}
      <section style={s.left} className="login-left" aria-hidden="false">
        <div style={s.leftOverlay} />
        {/* Floating decorative orbs */}
        <div style={{ ...s.orb, ...s.orb1 }} />
        <div style={{ ...s.orb, ...s.orb2 }} />
        <div style={{ ...s.orb, ...s.orb3 }} />

        <div style={s.leftContent}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={s.brandRow}
          >
            <div style={s.logoBadge} className="logo-float">
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-1px' }}>S</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>Soko</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: C.goldSoft, letterSpacing: '-1px' }}>Mw</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            style={s.headline}
          >
            Malawi&apos;s Trusted Marketplace
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            style={s.supporting}
          >
            Buy, sell, discover opportunities and connect with trusted people across Malawi.
          </motion.p>

          {/* Floating category chips */}
          <div style={s.chipRow}>
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.08, ease: 'easeOut' }}
                whileHover={{ y: -4, scale: 1.04 }}
                style={s.chip}
                className={`cat-chip cat-float-${i % 3}`}
              >
                <cat.icon size={16} strokeWidth={2.2} color={C.goldSoft} />
                <span>{cat.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            style={s.leftStats}
          >
            {STATS.map((stat) => (
              <div key={stat.label} style={s.stat}>
                <span style={s.statNum}>{stat.num}</span>
                <span style={s.statLabel}>{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════ RIGHT — Auth card ════════ */}
      <section style={s.right} className="login-right">
        {/* Mobile compact brand */}
        <div style={s.mobileBrand} className="mobile-brand">
          <div style={{ ...s.logoBadge, width: 40, height: 40, borderRadius: 12 }} className="logo-float">
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>S</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.green, letterSpacing: '-1px' }}>Soko</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.gold, letterSpacing: '-1px' }}>Mw</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={s.card}
        >
          {/* Success overlay */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={s.successOverlay}
              >
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  style={s.successCircle}
                >
                  <Check size={36} strokeWidth={3} color="#fff" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  style={{ marginTop: 18, fontSize: 16, fontWeight: 700, color: C.dark }}
                >
                  Welcome back!
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step indicator */}
          {mode !== 'choose' && (
            <div style={s.stepBar}>
              {[0, 1, 2].map((i) => {
                const step = mode === 'email' || mode === 'forgot' ? 0 : mode === 'verify_email' || mode === 'otp' ? 1 : 2
                return <div key={i} style={{ ...s.stepDot, ...(i <= step ? s.stepDotOn : {}) }} />
              })}
            </div>
          )}

          <div style={s.body}>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                {/* ── CHOOSE ── */}
                {mode === 'choose' && <>
                  <div style={s.headBlock}>
                    <h2 style={s.heading}>Welcome back</h2>
                    <p style={s.sub}>Sign in to continue to your marketplace</p>
                  </div>

                  <RippleButton style={s.googleBtn} onClick={handleGoogle} disabled={googleLoading}>
                    {googleLoading ? <Spinner dark /> : <>
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      Continue with Google
                    </>}
                  </RippleButton>

                  <div style={s.dividerRow}>
                    <div style={s.dividerLine} />
                    <span style={s.dividerText}>OR</span>
                    <div style={s.dividerLine} />
                  </div>

                  <RippleButton style={s.emailBtn} className="email-btn" onClick={() => { setMode('email'); clearMsg() }}>
                    <Mail size={18} strokeWidth={2.2} />
                    Continue with Email
                  </RippleButton>

                  <button style={s.guestLink} onClick={() => navigate('/')}>
                    Continue as Guest
                  </button>

                  <p style={s.terms}>
                    By continuing you agree to our{' '}
                    <a href="#terms" style={s.link}>Terms of Service</a> and{' '}
                    <a href="#privacy" style={s.link}>Privacy Policy</a>.
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
                    <input style={s.input} className="auth-input" type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
                  </Field>
                  <Field label="Password">
                    <input style={s.input} className="auth-input" type="password" placeholder="Min. 8 characters"
                      value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} autoComplete="current-password" />
                  </Field>
                  <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 18 }}>
                    <span style={s.link} onClick={() => { setMode('forgot'); clearMsg() }}>Forgot password?</span>
                  </div>
                  <Msg msg={message} />
                  <RippleButton style={s.primaryBtn} className="primary-btn" onClick={handleEmailSignIn} disabled={loading}>
                    {loading ? <Spinner /> : <>Sign In <ArrowRight size={18} strokeWidth={2.4} /></>}
                  </RippleButton>
                  <RippleButton style={s.ghostBtn} onClick={handleEmailSignUp} disabled={loading}>
                    {loading ? 'Sending code…' : "Don't have an account? Create one"}
                  </RippleButton>
                </>}

                {/* ── VERIFY EMAIL ── */}
                {mode === 'verify_email' && <>
                  <BackBtn onClick={() => { setMode('email'); clearMsg(); setOtpCode('') }} />
                  <div style={s.iconBadge} className="icon-float"><MailCheck size={26} color={C.green} strokeWidth={2.2} /></div>
                  <div style={s.headBlock}>
                    <h2 style={s.heading}>Check your email</h2>
                    <p style={s.sub}>We sent a 6-digit code to <strong style={{ color: C.green }}>{email}</strong></p>
                  </div>
                  <Field label="Verification code">
                    <input
                      style={{ ...s.input, fontSize: 26, fontWeight: 800, letterSpacing: 12, textAlign: 'center', padding: '14px 10px' }}
                      className="auth-input"
                      type="text" inputMode="numeric" maxLength={6} placeholder="······"
                      value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
                  </Field>
                  <Field label="Your name">
                    <input style={s.input} className="auth-input" type="text" placeholder="e.g. James Banda"
                      value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} />
                  </Field>
                  <p style={{ fontSize: 12, color: C.muted, marginTop: -10, marginBottom: 14 }}>
                    This is how other users will see you on Soko Malawi
                  </p>
                  <p style={s.resend}>
                    Didn&apos;t get it? <span style={s.link} onClick={() => { handleEmailSignUp(); setOtpCode('') }}>Resend code</span>
                  </p>
                  <Msg msg={message} />
                  <RippleButton style={s.primaryBtn} className="primary-btn" onClick={handleVerifyAndCreate} disabled={loading}>
                    {loading ? <Spinner /> : <>Create My Account <ArrowRight size={18} strokeWidth={2.4} /></>}
                  </RippleButton>
                </>}

                {/* ── FORGOT ── */}
                {mode === 'forgot' && <>
                  <BackBtn onClick={() => { setMode('email'); clearMsg() }} />
                  <div style={s.iconBadge} className="icon-float"><KeyRound size={26} color={C.green} strokeWidth={2.2} /></div>
                  <div style={s.headBlock}>
                    <h2 style={s.heading}>Reset password</h2>
                    <p style={s.sub}>Enter your email and we&apos;ll send a reset code</p>
                  </div>
                  <Field label="Email address">
                    <input style={s.input} className="auth-input" type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
                  </Field>
                  <Msg msg={message} />
                  <RippleButton style={s.primaryBtn} className="primary-btn" onClick={handleSendResetOtp} disabled={loading}>
                    {loading ? <Spinner /> : 'Send Reset Code'}
                  </RippleButton>
                </>}

                {/* ── RESET OTP ── */}
                {mode === 'otp' && <>
                  <div style={s.iconBadge} className="icon-float"><Lock size={26} color={C.green} strokeWidth={2.2} /></div>
                  <div style={s.headBlock}>
                    <h2 style={s.heading}>Enter code</h2>
                    <p style={s.sub}>Sent to <strong style={{ color: C.green }}>{email}</strong></p>
                  </div>
                  <Field label="6-digit code">
                    <input
                      style={{ ...s.input, fontSize: 26, fontWeight: 800, letterSpacing: 12, textAlign: 'center', padding: '14px 10px' }}
                      className="auth-input"
                      type="text" inputMode="numeric" maxLength={6} placeholder="······"
                      value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
                  </Field>
                  <p style={s.resend}>
                    Didn&apos;t get it? <span style={s.link} onClick={() => { setMode('forgot'); clearMsg(); setOtpCode('') }}>Resend</span>
                  </p>
                  <Msg msg={message} />
                  <RippleButton style={s.primaryBtn} className="primary-btn" onClick={handleVerifyResetOtp} disabled={loading}>
                    {loading ? <Spinner /> : 'Verify Code'}
                  </RippleButton>
                </>}

                {/* ── NEW PASSWORD ── */}
                {mode === 'newpass' && <>
                  <div style={s.iconBadge} className="icon-float"><ShieldCheck size={26} color={C.green} strokeWidth={2.2} /></div>
                  <div style={s.headBlock}>
                    <h2 style={s.heading}>New password</h2>
                    <p style={s.sub}>Choose a strong password for your account</p>
                  </div>
                  <Field label="New password">
                    <input style={s.input} className="auth-input" type="password" placeholder="Min. 8 characters"
                      value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
                  </Field>
                  <Field label="Confirm password">
                    <input style={s.input} className="auth-input" type="password" placeholder="Repeat your password"
                      value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
                  </Field>
                  <Msg msg={message} />
                  <RippleButton style={s.primaryBtn} className="primary-btn" onClick={handleSetNewPassword} disabled={loading}>
                    {loading ? <Spinner /> : 'Update Password'}
                  </RippleButton>
                </>}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={s.trustRow}
        >
          <TrustBadge icon={ShieldCheck} label="Secure" />
          <TrustBadge label="Made for Malawi" flag />
          <TrustBadge icon={Check} label="Free to use" />
        </motion.div>
      </section>
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Cars', icon: Car },
  { label: 'Phones', icon: Smartphone },
  { label: 'Property', icon: HomeIcon },
  { label: 'Jobs', icon: Briefcase },
  { label: 'Services', icon: Wrench },
]

const STATS = [
  { num: '12k+', label: 'Active listings' },
  { num: '8k+', label: 'Trusted sellers' },
  { num: '28', label: 'Districts' },
]

// ── Helper components ────────────────────────────────────────
function RippleButton({ children, style, className = '', onClick, disabled }) {
  function handleClick(e) {
    if (disabled) return
    const btn = e.currentTarget
    const circle = document.createElement('span')
    const d = Math.max(btn.clientWidth, btn.clientHeight)
    const rect = btn.getBoundingClientRect()
    circle.style.width = circle.style.height = `${d}px`
    circle.style.left = `${e.clientX - rect.left - d / 2}px`
    circle.style.top = `${e.clientY - rect.top - d / 2}px`
    circle.className = 'ripple'
    const existing = btn.querySelector('.ripple')
    if (existing) existing.remove()
    btn.appendChild(circle)
    setTimeout(() => circle.remove(), 600)
    onClick?.(e)
  }
  return (
    <button onClick={handleClick} disabled={disabled} className={`ripple-btn ${className}`} style={style}>
      {children}
    </button>
  )
}

function Spinner({ dark }) {
  return <Loader2 size={18} className="spin" color={dark ? C.green : '#fff'} />
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Go back" style={s.backBtn} className="back-btn">
      <ArrowLeft size={16} strokeWidth={2.5} color={C.green} />
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function Msg({ msg }) {
  if (!msg?.text) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 14, fontWeight: 500,
        background: msg.isError ? '#FEF2F2' : '#ECFDF3',
        border: `1px solid ${msg.isError ? '#FECACA' : '#BBF7D0'}`,
        color: msg.isError ? '#DC2626' : C.green,
      }}
    >
      {msg.text}
    </motion.div>
  )
}

function TrustBadge({ icon: Icon, label, flag }) {
  return (
    <div style={s.trustBadge}>
      {flag ? <span style={{ fontSize: 14, lineHeight: 1 }}>🇲🇼</span> : Icon && <Icon size={14} color={C.green} strokeWidth={2.2} />}
      <span style={{ fontSize: 12, fontWeight: 600, color: '#3D4A42' }}>{label}</span>
    </div>
  )
}

// ── Global CSS (animations + focus + responsive) ─────────────
const styleTag = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.7s linear infinite; }

  @keyframes logoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  .logo-float { animation: logoFloat 3.5s ease-in-out infinite; }
  .icon-float { animation: logoFloat 3s ease-in-out infinite; }

  @keyframes catFloat0 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @keyframes catFloat1 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-11px); } }
  @keyframes catFloat2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  .cat-float-0 { animation: catFloat0 4s ease-in-out infinite; }
  .cat-float-1 { animation: catFloat1 5s ease-in-out infinite; }
  .cat-float-2 { animation: catFloat2 4.5s ease-in-out infinite; }

  @keyframes orbDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,-24px) scale(1.08); } }

  /* Inputs */
  .auth-input::placeholder { color: #9CA3AF; }
  .auth-input:focus {
    outline: none !important;
    border-color: ${C.green} !important;
    background: #fff !important;
    box-shadow: 0 0 0 4px rgba(21,128,61,0.12) !important;
  }

  /* Button interactions */
  .ripple-btn { position: relative; overflow: hidden; font-family: inherit; transition: transform 250ms cubic-bezier(.2,.8,.2,1), box-shadow 250ms ease, background 250ms ease; }
  .ripple-btn:not(:disabled):hover { transform: translateY(-2px) scale(1.02); }
  .ripple-btn:not(:disabled):active { transform: scale(0.98); }
  .ripple-btn:disabled { opacity: 0.7; cursor: default; }
  .ripple-btn:focus-visible { outline: 3px solid rgba(21,128,61,0.4); outline-offset: 2px; }

  .primary-btn:not(:disabled):hover { box-shadow: 0 10px 26px rgba(212,160,23,0.45), 0 4px 14px rgba(21,128,61,0.3); }
  .email-btn:not(:disabled):hover { box-shadow: 0 10px 26px rgba(212,160,23,0.4); }

  .back-btn { transition: background 0.2s, transform 0.2s; }
  .back-btn:hover { background: #E3F0E8 !important; transform: translateX(-2px); }

  .ripple {
    position: absolute; border-radius: 50%; transform: scale(0);
    animation: rippleAnim 0.6s linear; background: rgba(255,255,255,0.45); pointer-events: none;
  }
  .ripple-btn[style*="background: rgb(255, 255, 255)"] .ripple,
  .ripple-btn.email-btn .ripple { }
  @keyframes rippleAnim { to { transform: scale(2.6); opacity: 0; } }

  a { text-decoration: none; }
  a:focus-visible, span:focus-visible { outline: 2px solid rgba(21,128,61,0.4); outline-offset: 2px; border-radius: 4px; }

  /* Responsive — single column on mobile/tablet */
  .mobile-brand { display: none; }
  @media (max-width: 900px) {
    .login-left { display: none !important; }
    .login-right { width: 100% !important; }
    .mobile-brand { display: flex !important; }
  }
`

// ── Styles ───────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: C.bg,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    color: C.dark,
  },

  // ── Left panel ──
  left: {
    width: '60%',
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(140deg, ${C.greenDark} 0%, ${C.green} 48%, #6E7A1E 100%)`,
    display: 'flex',
    alignItems: 'center',
  },
  leftOverlay: {
    position: 'absolute', inset: 0,
    background: `radial-gradient(circle at 78% 18%, rgba(212,160,23,0.30), transparent 45%), radial-gradient(circle at 12% 88%, rgba(34,160,94,0.35), transparent 50%)`,
    pointerEvents: 'none',
  },
  orb: { position: 'absolute', borderRadius: '50%', filter: 'blur(2px)', pointerEvents: 'none' },
  orb1: { width: 260, height: 260, top: '-60px', right: '8%', background: 'rgba(212,160,23,0.18)', animation: 'orbDrift 14s ease-in-out infinite' },
  orb2: { width: 200, height: 200, bottom: '-40px', left: '12%', background: 'rgba(255,255,255,0.08)', animation: 'orbDrift 18s ease-in-out infinite reverse' },
  orb3: { width: 130, height: 130, top: '40%', right: '30%', background: 'rgba(212,160,23,0.12)', animation: 'orbDrift 16s ease-in-out infinite' },
  leftContent: {
    position: 'relative', zIndex: 2,
    padding: '0 8% ',
    maxWidth: 620,
    margin: '0 auto',
    width: '100%',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 },
  logoBadge: {
    width: 52, height: 52, borderRadius: 16,
    background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldSoft} 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(212,160,23,0.45)',
  },
  headline: {
    fontSize: 'clamp(34px, 4.4vw, 56px)',
    fontWeight: 800, lineHeight: 1.05, letterSpacing: '-1.5px',
    color: '#fff', margin: 0, marginBottom: 22,
    textWrap: 'balance',
  },
  supporting: {
    fontSize: 'clamp(16px, 1.4vw, 19px)',
    lineHeight: 1.6, color: 'rgba(255,255,255,0.88)',
    maxWidth: 460, margin: 0, marginBottom: 40,
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 56 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px', borderRadius: 999,
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.22)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'default',
  },
  leftStats: { display: 'flex', gap: 40 },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statNum: { fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 },

  // ── Right panel ──
  right: {
    width: '40%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 28px',
    position: 'relative',
  },
  mobileBrand: { alignItems: 'center', gap: 10, marginBottom: 26 },
  card: {
    position: 'relative',
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 24,
    width: '100%', maxWidth: 408,
    boxShadow: '0 24px 60px -20px rgba(21,128,61,0.28), 0 8px 24px rgba(26,26,26,0.06)',
    overflow: 'hidden',
  },
  successOverlay: {
    position: 'absolute', inset: 0, zIndex: 10,
    background: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(4px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  },
  successCircle: {
    width: 72, height: 72, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C.green}, ${C.greenSoft})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 12px 30px rgba(21,128,61,0.4)',
  },
  stepBar: { display: 'flex', gap: 6, padding: '20px 30px 0', justifyContent: 'center' },
  stepDot: { height: 4, width: 24, borderRadius: 2, background: C.line, transition: 'all 0.3s' },
  stepDotOn: { background: C.green, width: 40 },
  body: { padding: '30px 30px 34px', position: 'relative' },
  headBlock: { marginBottom: 22 },
  heading: { fontSize: 26, fontWeight: 800, color: C.dark, lineHeight: 1.15, margin: 0, marginBottom: 6, letterSpacing: '-0.5px' },
  sub: { fontSize: 14, color: C.muted, lineHeight: 1.55, margin: 0 },
  iconBadge: {
    width: 56, height: 56, borderRadius: 16, background: '#ECFDF3',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700, color: C.muted,
    marginBottom: 7, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  input: {
    width: '100%', border: `1.5px solid ${C.line}`, borderRadius: 12,
    padding: '13px 14px', fontSize: 15, display: 'block',
    marginBottom: 16, background: '#fff', color: C.dark,
    fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  },
  primaryBtn: {
    width: '100%',
    background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenSoft} 100%)`,
    color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 6px 20px rgba(21,128,61,0.32)', marginTop: 4,
  },
  ghostBtn: {
    width: '100%', background: 'transparent', color: C.green,
    border: `1.5px solid #CFE7D8`, borderRadius: 12, padding: '14px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10,
  },
  googleBtn: {
    width: '100%', background: '#fff', color: C.dark,
    border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '14px 16px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(26,26,26,0.06)',
  },
  emailBtn: {
    width: '100%',
    background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenSoft} 100%)`,
    color: '#fff', border: 'none', borderRadius: 12, padding: '14px 16px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 6px 20px rgba(21,128,61,0.3)',
  },
  guestLink: {
    width: '100%', background: 'transparent', color: C.muted,
    border: 'none', padding: '14px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', marginTop: 6, fontFamily: 'inherit',
  },
  dividerRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' },
  dividerLine: { flex: 1, height: 1, background: C.line },
  dividerText: { fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: 1 },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    background: '#ECFDF3', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  link: { color: C.green, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  resend: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 14 },
  terms: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 18, lineHeight: 1.6 },
  trustRow: { display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' },
  trustBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', borderRadius: 20, padding: '6px 13px',
    border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(26,26,26,0.04)',
  },
}
