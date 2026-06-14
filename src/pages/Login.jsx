import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  goldDark: '#f57f17',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#d8e8da',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  success: '#15803d',
  successBg: '#f0fdf4',
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes sk-fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sk-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes sk-pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.08); }
  }
  @keyframes sk-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes sk-float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%      { transform: translateY(-12px) rotate(1deg); }
    66%      { transform: translateY(-6px) rotate(-1deg); }
  }
  @keyframes sk-floatB {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(-18px) rotate(-2deg); }
  }

  .sk-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    background: ${T.offwhite};
  }

  /* ── LEFT PANEL ── */
  .sk-left {
    width: 45%;
    min-height: 100vh;
    background: linear-gradient(155deg, ${T.greenDark} 0%, #2d6a31 50%, #1a4d1e 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 52px;
    position: relative;
    overflow: hidden;
  }

  .sk-left-noise {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px;
    opacity: 0.5;
    pointer-events: none;
  }

  .sk-left-glow1 {
    position: absolute;
    top: -80px; right: -80px;
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(249,168,37,0.18) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }
  .sk-left-glow2 {
    position: absolute;
    bottom: 80px; left: -60px;
    width: 280px; height: 280px;
    background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }

  .sk-left-brand {
    position: relative;
    z-index: 2;
  }
  .sk-left-logo {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: -1.5px;
    line-height: 1;
    color: ${T.white};
  }
  .sk-left-logo span { color: ${T.gold}; }

  .sk-left-tagline {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
    margin-top: 8px;
  }

  .sk-left-hero {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0;
  }

  .sk-left-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: ${T.gold};
    margin-bottom: 16px;
  }

  .sk-left-headline {
    font-size: 40px;
    font-weight: 900;
    color: ${T.white};
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin-bottom: 20px;
  }
  .sk-left-headline em {
    font-style: normal;
    color: ${T.gold};
  }

  .sk-left-desc {
    font-size: 15px;
    color: rgba(255,255,255,0.65);
    line-height: 1.65;
    max-width: 340px;
    margin-bottom: 44px;
  }

  .sk-stats {
    display: flex;
    gap: 32px;
  }
  .sk-stat-item {}
  .sk-stat-num {
    font-size: 26px;
    font-weight: 900;
    color: ${T.white};
    letter-spacing: -1px;
    line-height: 1;
  }
  .sk-stat-label {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }

  .sk-left-cards {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sk-float-card {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    backdrop-filter: blur(8px);
  }
  .sk-float-card:first-child { animation: sk-float 6s ease-in-out infinite; }
  .sk-float-card:last-child  { animation: sk-floatB 8s ease-in-out infinite; }

  .sk-float-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255,255,255,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .sk-float-text-top {
    font-size: 12px;
    font-weight: 700;
    color: ${T.white};
    line-height: 1.2;
  }
  .sk-float-text-bot {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    margin-top: 2px;
  }
  .sk-float-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 9px;
    border-radius: 20px;
    background: rgba(249,168,37,0.2);
    color: ${T.gold};
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  /* ── RIGHT PANEL ── */
  .sk-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 40px;
    min-height: 100vh;
    position: relative;
    overflow-y: auto;
  }

  .sk-form-wrap {
    width: 100%;
    max-width: 400px;
    animation: sk-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }

  .sk-right-top {
    margin-bottom: 36px;
  }
  .sk-right-title {
    font-size: 26px;
    font-weight: 800;
    color: ${T.text};
    letter-spacing: -0.8px;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .sk-right-sub {
    font-size: 14px;
    color: ${T.textMuted};
    line-height: 1.5;
  }

  /* Google btn */
  .sk-btn-google {
    width: 100%;
    background: ${T.white};
    border: 1.5px solid ${T.border};
    border-radius: 12px;
    padding: 13px 20px;
    font-size: 14.5px;
    font-weight: 600;
    font-family: inherit;
    color: ${T.text};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .sk-btn-google:hover {
    border-color: #aac5ac;
    background: #fafbfa;
    box-shadow: 0 3px 12px rgba(0,0,0,0.06);
  }
  .sk-btn-google:active { transform: scale(0.99); }
  .sk-btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

  .sk-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
  }
  .sk-divider-line {
    flex: 1;
    height: 1px;
    background: ${T.border};
  }
  .sk-divider-text {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: ${T.textLight};
  }

  /* Email btn (choose screen) */
  .sk-btn-email-cta {
    width: 100%;
    background: linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%);
    color: ${T.white};
    border: none;
    border-radius: 12px;
    padding: 14px 20px;
    font-size: 14.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 16px rgba(46,125,50,0.28);
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .sk-btn-email-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  }
  .sk-btn-email-cta:hover {
    box-shadow: 0 6px 22px rgba(46,125,50,0.38);
    transform: translateY(-1px);
  }
  .sk-btn-email-cta:active { transform: scale(0.99) translateY(0); }

  /* Primary action btn */
  .sk-btn-primary {
    width: 100%;
    background: linear-gradient(135deg, ${T.gold} 0%, ${T.goldDark} 100%);
    color: ${T.text};
    border: none;
    border-radius: 12px;
    padding: 14px 20px;
    font-size: 14.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(249,168,37,0.35);
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .sk-btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
  }
  .sk-btn-primary:hover {
    box-shadow: 0 6px 22px rgba(249,168,37,0.45);
    transform: translateY(-1px);
  }
  .sk-btn-primary:active { transform: scale(0.99); }
  .sk-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* Secondary ghost btn */
  .sk-btn-secondary {
    width: 100%;
    background: transparent;
    color: ${T.green};
    border: 1.5px solid ${T.greenLight};
    border-radius: 12px;
    padding: 13px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 10px;
  }
  .sk-btn-secondary:hover {
    background: ${T.greenLight};
    border-color: #c8e6c9;
  }
  .sk-btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Field */
  .sk-field { margin-bottom: 18px; }
  .sk-label {
    display: block;
    font-size: 11.5px;
    font-weight: 700;
    color: ${T.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.7px;
    margin-bottom: 7px;
  }
  .sk-input-wrap {
    position: relative;
  }
  .sk-input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: ${T.textLight};
    display: flex;
    pointer-events: none;
    transition: color 0.2s;
  }
  .sk-input {
    width: 100%;
    border: 1.5px solid ${T.border};
    border-radius: 11px;
    padding: 13px 14px 13px 42px;
    font-size: 14.5px;
    font-weight: 500;
    font-family: inherit;
    color: ${T.text};
    background: ${T.white};
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .sk-input::placeholder { color: #b0c4b3; }
  .sk-input:focus {
    outline: none;
    border-color: ${T.green};
    box-shadow: 0 0 0 3.5px rgba(46,125,50,0.1);
  }
  .sk-input:focus ~ .sk-input-icon { color: ${T.green}; }

  .sk-input-otp {
    width: 100%;
    border: 1.5px solid ${T.border};
    border-radius: 11px;
    padding: 14px;
    font-size: 28px;
    font-weight: 800;
    font-family: 'Inter', monospace;
    letter-spacing: 14px;
    text-align: center;
    color: ${T.text};
    background: ${T.white};
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .sk-input-otp:focus {
    outline: none;
    border-color: ${T.green};
    box-shadow: 0 0 0 3.5px rgba(46,125,50,0.1);
  }

  /* Forgot row */
  .sk-row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -6px 0 20px;
  }

  /* Back button */
  .sk-back {
    width: 34px; height: 34px;
    border-radius: 10px;
    background: ${T.greenLight};
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${T.green};
    transition: background 0.2s, transform 0.15s;
    margin-bottom: 20px;
  }
  .sk-back:hover { background: #d0ead2; transform: scale(1.05); }

  /* Icon badge */
  .sk-icon-badge {
    width: 56px; height: 56px;
    border-radius: 15px;
    background: ${T.greenLight};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 16px;
  }

  /* Msg */
  .sk-msg {
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 18px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.45;
    animation: sk-fadeUp 0.2s ease both;
  }
  .sk-msg-error { background: ${T.dangerBg}; border: 1px solid #fecaca; color: ${T.danger}; }
  .sk-msg-info  { background: ${T.successBg}; border: 1px solid #bbf7d0; color: ${T.success}; }

  /* Step dots */
  .sk-steps {
    display: flex;
    gap: 6px;
    margin-bottom: 28px;
  }
  .sk-dot {
    height: 4px;
    border-radius: 2px;
    background: ${T.border};
    transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
    width: 20px;
  }
  .sk-dot.on { background: ${T.green}; width: 36px; }

  /* Link */
  .sk-link {
    color: ${T.green};
    font-weight: 700;
    cursor: pointer;
    font-size: 13.5px;
    text-decoration: none;
    transition: color 0.2s;
  }
  .sk-link:hover { color: ${T.greenDark}; text-decoration: underline; }

  /* Trust row */
  .sk-trust {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 28px;
    justify-content: center;
  }
  .sk-trust-pill {
    font-size: 11px;
    font-weight: 700;
    color: ${T.textMuted};
    background: ${T.white};
    border: 1px solid ${T.border};
    border-radius: 20px;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* Bottom note */
  .sk-bottom-note {
    text-align: center;
    font-size: 11.5px;
    color: ${T.textLight};
    margin-top: 24px;
    line-height: 1.6;
  }

  /* Spinner */
  .sk-spinner {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    animation: sk-spin 0.6s linear infinite;
  }
  .sk-spinner-dark {
    border-color: rgba(46,125,50,0.15);
    border-top-color: ${T.green};
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 860px) {
    .sk-root { flex-direction: column; }
    .sk-left {
      width: 100%;
      min-height: auto;
      padding: 36px 28px 32px;
    }
    .sk-left-hero { padding: 28px 0 24px; }
    .sk-left-headline { font-size: 30px; }
    .sk-left-cards { display: none; }
    .sk-right { padding: 36px 24px 48px; }
  }
`

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
  const [message, setMessage]         = useState(() => {
    if (localStorage.getItem('sk_disabled')) {
      localStorage.removeItem('sk_disabled')
      return {
        isError: false,
        text: `Thank you for being one of our early testers. Your feedback has been incredibly valuable to us.\n\nWe are currently working on significant improvements to SokoMW based on what you and other testers shared with us. As a result, access has been temporarily paused while we build these new features.\n\nWe will notify you as soon as the updated version is ready — we think you'll love what's coming. Thank you for your patience and continued support.`
      }
    }
    return { text: '', isError: false }
  })
  const navigate = useNavigate()

  const SUPABASE_URL = supabase.supabaseUrl

  function setError(text) { setMessage({ text, isError: true }) }
  function setInfo(text)  { setMessage({ text, isError: false }) }
  function clearMsg()     { setMessage({ text: '', isError: false }) }

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
    const { data: profile } = await supabase.from('profiles').select('role, is_disabled').eq('id', data.user.id).single()
    if (profile?.is_disabled) {
      await supabase.auth.signOut()
      setLoading(false)
      setMessage({
        isError: false,
        text: `Thank you for being one of our early testers. Your feedback has been incredibly valuable to us.\n\nWe are currently working on significant improvements to SokoMW based on what you and other testers shared with us. As a result, access has been temporarily paused while we build these new features.\n\nWe will notify you as soon as the updated version is ready — we think you'll love what's coming. Thank you for your patience and continued support.`
      })
      return
    }
    setLoading(false)
    navigate(profile?.role === 'admin' ? '/admin' : '/')
  }

  async function handleEmailSignUp() {
    if (!email || !password) { setError('Enter email and password'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo('Verification code sent to your email.')
    setMode('verify_email')
  }

  async function handleVerifyAndCreate() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    if (!username.trim()) { setError('Choose a username'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setLoading(false); setError(data.error || 'Invalid or expired code'); return }
    const { error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { email_verified: true, full_name: username.trim() }, emailRedirectTo: null },
    })
    if (signUpErr) { setLoading(false); setError(signUpErr.message); return }
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInErr) {
      setLoading(false)
      setInfo('Account created! Check your email for a confirmation link.')
      setMode('email'); setOtpCode(''); return
    }
    await supabase.from('profiles').upsert({ id: signInData.user.id, full_name: username.trim(), updated_at: new Date().toISOString() })
    await supabase.from('users').upsert({ id: signInData.user.id, name: username.trim() }, { onConflict: 'id' })
    setLoading(false); navigate('/')
  }

  async function handleSendResetOtp() {
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Failed to send code'); return }
    setInfo('Code sent to your email.'); setMode('otp')
  }

  async function handleVerifyResetOtp() {
    if (!otpCode || otpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ identifier: email.trim(), code: otpCode }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error || 'Invalid code'); return }
    setInfo('Verified! Set your new password.'); setMode('newpass')
  }

  async function handleSetNewPassword() {
    if (!newPass || !confirmPass) { setError('Fill in both fields'); return }
    if (newPass.length < 8)       { setError('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass)  { setError('Passwords do not match'); return }
    setLoading(true); clearMsg()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
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
    const actions = { email: handleEmailSignIn, verify_email: handleVerifyAndCreate, forgot: handleSendResetOtp, otp: handleVerifyResetOtp, newpass: handleSetNewPassword }
    actions[mode]?.()
  }

  const stepIndex = { email: 0, verify_email: 1, forgot: 0, otp: 1, newpass: 2 }[mode] ?? -1

  return (
    <div className="sk-root">
      <style>{css}</style>

      {/* ── LEFT PANEL ── */}
      <div className="sk-left">
        <div className="sk-left-noise" />
        <div className="sk-left-glow1" />
        <div className="sk-left-glow2" />

        <div className="sk-left-brand">
          <div className="sk-left-logo">Soko<span>MW</span></div>
          <div className="sk-left-tagline">Buy · Sell · Jobs · Services</div>
        </div>

        <div className="sk-left-hero">
          <div className="sk-left-eyebrow">🇲🇼 Malawi's #1 Marketplace</div>
          <h2 className="sk-left-headline">
            Trade smarter.<br />
            Grow <em>faster</em>.
          </h2>
          <p className="sk-left-desc">
            Join thousands of buyers and sellers from Lilongwe, Blantyre, and beyond. Buy, sell, find work — all in one place.
          </p>
          <div className="sk-stats">
            <div className="sk-stat-item">
              <div className="sk-stat-num">10K+</div>
              <div className="sk-stat-label">Active sellers</div>
            </div>
            <div className="sk-stat-item">
              <div className="sk-stat-num">3</div>
              <div className="sk-stat-label">Major cities</div>
            </div>
            <div className="sk-stat-item">
              <div className="sk-stat-num">Free</div>
              <div className="sk-stat-label">To join</div>
            </div>
          </div>
        </div>

        <div className="sk-left-cards">
          <div className="sk-float-card">
            <div className="sk-float-icon">📦</div>
            <div>
              <div className="sk-float-text-top">New listing posted</div>
              <div className="sk-float-text-bot">Blantyre · Electronics</div>
            </div>
            <div className="sk-float-badge">Just now</div>
          </div>
          <div className="sk-float-card">
            <div className="sk-float-icon">💼</div>
            <div>
              <div className="sk-float-text-top">Job offer received</div>
              <div className="div sk-float-text-bot">Lilongwe · Design</div>
            </div>
            <div className="sk-float-badge">2 min ago</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="sk-right">
        <div className="sk-form-wrap">

          {/* Step dots */}
          {stepIndex >= 0 && (
            <div className="sk-steps">
              {[0,1,2].map(i => <div key={i} className={`sk-dot ${i <= stepIndex ? 'on' : ''}`} />)}
            </div>
          )}

          {/* ── CHOOSE ── */}
          {mode === 'choose' && (
            <>
              <div className="sk-right-top">
                <h1 className="sk-right-title">Welcome back 👋</h1>
                <p className="sk-right-sub">Sign in to your SokoMW account to continue.</p>
              </div>

              <button className="sk-btn-google" onClick={handleGoogle} disabled={googleLoading}>
                {googleLoading ? <div className="sk-spinner sk-spinner-dark" /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <div className="sk-divider">
                <div className="sk-divider-line" />
                <span className="sk-divider-text">OR</span>
                <div className="sk-divider-line" />
              </div>

              <button className="sk-btn-email-cta" onClick={() => { setMode('email'); clearMsg() }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Continue with Email
              </button>

              <div className="sk-trust">
                {[['🛡️','Secure & private'],['🇲🇼','Built for Malawi'],['✨','Always free']].map(([icon,label]) => (
                  <div key={label} className="sk-trust-pill"><span>{icon}</span><span>{label}</span></div>
                ))}
              </div>

              <p className="sk-bottom-note">
                By continuing, you agree to our{' '}
                <span className="sk-link">Terms</span> and{' '}
                <span className="sk-link">Privacy Policy</span>.
              </p>
            </>
          )}

          {/* ── EMAIL SIGN IN ── */}
          {mode === 'email' && (
            <>
              <button className="sk-back" onClick={() => { setMode('choose'); clearMsg() }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <div className="sk-right-top">
                <h1 className="sk-right-title">Sign in</h1>
                <p className="sk-right-sub">Enter your details to access your account.</p>
              </div>
              <Field label="Email address" icon={<MailIcon />}>
                <input className="sk-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
              </Field>
              <Field label="Password" icon={<LockIcon />}>
                <input className="sk-input" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} autoComplete="current-password" />
              </Field>
              <div className="sk-row-between">
                <span />
                <span className="sk-link" onClick={() => { setMode('forgot'); clearMsg() }}>Forgot password?</span>
              </div>
              <Msg msg={message} />
              <button className="sk-btn-primary" onClick={handleEmailSignIn} disabled={loading}>
                {loading ? <div className="sk-spinner" /> : 'Sign In →'}
              </button>
              <button className="sk-btn-secondary" onClick={handleEmailSignUp} disabled={loading}>
                {loading ? 'Sending code…' : "New to SokoMW? Create account"}
              </button>
            </>
          )}

          {/* ── VERIFY + REGISTER ── */}
          {mode === 'verify_email' && (
            <>
              <button className="sk-back" onClick={() => { setMode('email'); clearMsg(); setOtpCode('') }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <div className="sk-icon-badge">✉️</div>
              <div className="sk-right-top">
                <h1 className="sk-right-title">Check your inbox</h1>
                <p className="sk-right-sub">We sent a 6-digit code to <strong style={{ color: T.green }}>{email}</strong></p>
              </div>
              <Field label="Verification code">
                <input className="sk-input-otp" type="text" inputMode="numeric" maxLength={6} placeholder="······" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g,''))} onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
              </Field>
              <Field label="Choose a username" icon={<UserIcon />}>
                <input className="sk-input" type="text" placeholder="e.g. jbanda" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} />
              </Field>
              <p style={{ fontSize: 12, color: T.textLight, marginTop: -10, marginBottom: 18, lineHeight: 1.45 }}>
                Didn't get the code? <span className="sk-link" onClick={() => { handleEmailSignUp(); setOtpCode('') }}>Resend</span>
              </p>
              <Msg msg={message} />
              <button className="sk-btn-primary" onClick={handleVerifyAndCreate} disabled={loading}>
                {loading ? <div className="sk-spinner" /> : 'Verify & Create Account'}
              </button>
            </>
          )}

          {/* ── FORGOT ── */}
          {mode === 'forgot' && (
            <>
              <button className="sk-back" onClick={() => { setMode('email'); clearMsg() }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <div className="sk-icon-badge">🔑</div>
              <div className="sk-right-top">
                <h1 className="sk-right-title">Reset password</h1>
                <p className="sk-right-sub">Enter your email and we'll send a reset code.</p>
              </div>
              <Field label="Email address" icon={<MailIcon />}>
                <input className="sk-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
              </Field>
              <Msg msg={message} />
              <button className="sk-btn-primary" onClick={handleSendResetOtp} disabled={loading}>
                {loading ? <div className="sk-spinner" /> : 'Send Reset Code'}
              </button>
            </>
          )}

          {/* ── OTP VERIFY ── */}
          {mode === 'otp' && (
            <>
              <div className="sk-icon-badge">🔐</div>
              <div className="sk-right-top">
                <h1 className="sk-right-title">Enter reset code</h1>
                <p className="sk-right-sub">Sent to <strong style={{ color: T.green }}>{email}</strong></p>
              </div>
              <Field label="6-digit code">
                <input className="sk-input-otp" type="text" inputMode="numeric" maxLength={6} placeholder="······" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g,''))} onKeyDown={handleKeyDown} autoComplete="one-time-code" autoFocus />
              </Field>
              <p style={{ textAlign: 'center', fontSize: 13, color: T.textLight, margin: '10px 0 18px' }}>
                Didn't receive it? <span className="sk-link" onClick={() => { setMode('forgot'); clearMsg(); setOtpCode('') }}>Resend</span>
              </p>
              <Msg msg={message} />
              <button className="sk-btn-primary" onClick={handleVerifyResetOtp} disabled={loading}>
                {loading ? <div className="sk-spinner" /> : 'Verify Code'}
              </button>
            </>
          )}

          {/* ── NEW PASSWORD ── */}
          {mode === 'newpass' && (
            <>
              <div className="sk-icon-badge">🛡️</div>
              <div className="sk-right-top">
                <h1 className="sk-right-title">New password</h1>
                <p className="sk-right-sub">Choose something strong — at least 8 characters.</p>
              </div>
              <Field label="New password" icon={<LockIcon />}>
                <input className="sk-input" type="password" placeholder="At least 8 characters" value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
              </Field>
              <Field label="Confirm password" icon={<LockIcon />}>
                <input className="sk-input" type="password" placeholder="Repeat your password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
              </Field>
              <Msg msg={message} />
              <button className="sk-btn-primary" onClick={handleSetNewPassword} disabled={loading}>
                {loading ? <div className="sk-spinner" /> : 'Update Password'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function Field({ label, children, icon }) {
  return (
    <div className="sk-field">
      <label className="sk-label">{label}</label>
      <div className="sk-input-wrap">
        {children}
        {icon && <div className="sk-input-icon">{icon}</div>}
      </div>
    </div>
  )
}

function Msg({ msg }) {
  if (!msg?.text) return null
  return (
    <div className={`sk-msg ${msg.isError ? 'sk-msg-error' : 'sk-msg-info'}`}>
      <span style={{ fontSize: 15 }}>{msg.isError ? '⚠️' : '✅'}</span>
      <div style={{ flex: 1, whiteSpace: 'pre-line' }}>{msg.text}</div>
    </div>
  )
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}