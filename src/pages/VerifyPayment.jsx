import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  reconcileVerificationPayment,
  cancelVerificationPayment,
  markFeaturePaymentOutcome,
} from '../lib/verification'

const C = {
  green: '#1a7a4a', greenMid: '#22a05e', greenDeep: '#0d4a2c',
  greenLight: '#e6f7ee', greenTint: '#f0faf4',
  gold: '#d4920a', amber: '#f59e0b', amberDeep: '#b45309',
  amberBg: '#fffbeb', amberBorder: '#fde68a',
  dark: '#0f1410', muted: '#637068', faint: '#9aafa0',
  border: '#d8e5dc', line: '#e8ede9',
  surface: '#f4f8f5', white: '#ffffff',
  red: '#dc2626', redBg: '#fef2f2', redBorder: '#fecaca',
  orange: '#c2410c', orangeBg: '#ffedd5',
}
const SORA = "'Sora', system-ui, sans-serif"
const DMSANS = "'DM Sans', system-ui, sans-serif"

const RECONCILE_TIMEOUT_MS = 28000

/* ── Icons ── */
const Icon = {
  star: (s = 30, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  shieldCheck: (s = 30, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  undo: (s = 30, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  alert: (s = 30, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  clock: (s = 30, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  arrowRight: (s = 16, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
}

function IconBadge({ children, gradient, glow }) {
  return (
    <div style={{
      width: 84, height: 84, borderRadius: '50%',
      background: gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 22px', boxShadow: glow,
      animation: 'vpPop 0.5s cubic-bezier(0.34,1.4,0.64,1) both',
    }}>
      {children}
    </div>
  )
}

function VPCard({ children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 24, padding: '40px 32px',
      textAlign: 'center', maxWidth: 400, width: '100%',
      boxShadow: '0 4px 24px rgba(15,20,16,0.06), 0 24px 64px -24px rgba(15,20,16,0.18)',
      border: `1px solid ${C.line}`,
      animation: 'vpSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      {children}
    </div>
  )
}

function PrimaryButton({ children, onClick, style, disabled }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: `linear-gradient(135deg, ${C.greenMid}, ${C.greenDeep})`,
        color: C.white, border: 'none', borderRadius: 14,
        padding: '15px 24px', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: DMSANS, letterSpacing: '-0.01em',
        opacity: disabled ? 0.6 : 1,
        boxShadow: hover && !disabled
          ? '0 10px 24px -6px rgba(26,122,74,0.5)'
          : '0 6px 18px -6px rgba(26,122,74,0.4)',
        transform: hover && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s ease',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, disabled }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', background: hover ? C.greenTint : C.white,
        border: `1.5px solid ${hover ? C.greenMid : C.border}`,
        borderRadius: 14, padding: '13px 24px', fontSize: 14, fontWeight: 600,
        color: hover ? C.green : '#374151', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: DMSANS,
        transition: 'all 0.15s ease', marginTop: 10, opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

/**
 * Payment return page — does NOT trust browser ?status alone.
 * Always reconciles with PayChangu via verify-transaction edge function.
 */
export default function VerifyPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // UI states: processing | success | failed | cancelled | expired
  const [status, setStatus] = useState('processing')
  const [detail, setDetail] = useState('')
  const [isFeatureFlow, setIsFeatureFlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const ranRef = useRef(false)
  const txRef = params.get('tx_ref') || params.get('txRef') || ''

  /**
   * Phase 0.2 — apply feature payment result.
   * Featured success UI only when feature_confirmed (server activated flags).
   * Non-success outcomes always mark feature outcome so listing stays unfeatured.
   */
  async function applyFeatureReconcileResult(result) {
    if (result.confirmed && result.feature_confirmed) {
      setStatus('success')
      setDetail('Payment successful. Your listing is now featured.')
      return
    }

    if (result.confirmed && !result.feature_confirmed) {
      // Gateway paid but activation RPC failed — do not claim featured; try client confirm once
      const { data: conf, error: confirmErr } = await supabase.rpc('confirm_feature_payment', {
        p_tx_ref: txRef,
      })
      if (!confirmErr && conf) {
        setStatus('success')
        setDetail('Payment successful. Your listing is now featured.')
        return
      }
      setStatus('failed')
      setDetail(
        result.feature_error
          || confirmErr?.message
          || 'Payment was received but featuring could not be activated. Tap “Check again” or contact support — do not pay twice.'
      )
      return
    }

    const outcome = result.outcome || 'failed'
    if (outcome === 'cancelled' || outcome === 'expired' || outcome === 'failed') {
      await markFeaturePaymentOutcome(txRef, outcome, result.message)
    }

    if (outcome === 'cancelled') {
      setStatus('cancelled')
      setDetail(result.message || 'Payment cancelled. Your listing was not featured.')
      return
    }
    if (outcome === 'expired') {
      setStatus('expired')
      setDetail(result.message || 'Payment expired. Your listing was not featured.')
      return
    }
    if (outcome === 'pending') {
      setStatus('processing')
      setDetail('Payment is still processing with the provider. Tap “Check again” in a few seconds.')
      return
    }

    setStatus('failed')
    setDetail(result.message || 'Payment was not completed. Your listing was not featured.')
  }

  async function recheck() {
    if (!txRef || retrying) return
    setRetrying(true)
    setStatus('processing')
    setDetail('Processing payment…')
    try {
      const result = await reconcileVerificationPayment(txRef)
      const isFeature = txRef.startsWith('SOKO-FEATURE-')
      setIsFeatureFlow(isFeature)

      if (isFeature) {
        await applyFeatureReconcileResult(result)
        return
      }

      if (result.confirmed) {
        setStatus('success')
        setDetail('Payment successful. Your verification request is under review.')
      } else if (result.outcome === 'cancelled') {
        setStatus('cancelled')
        setDetail(result.message || 'Payment cancelled.')
      } else if (result.outcome === 'expired') {
        setStatus('expired')
        setDetail(result.message || 'Payment expired.')
      } else if (result.outcome === 'pending') {
        setStatus('processing')
        setDetail('Still processing. Please wait a moment and check again.')
      } else {
        setStatus('failed')
        setDetail(result.message || 'Payment was not completed. You can try again.')
      }
    } catch {
      setStatus('failed')
      setDetail('Payment was not completed. You can try again.')
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    // Prevent double-run (React StrictMode / double return)
    if (ranRef.current) return
    ranRef.current = true

    async function handle() {
      const payStatus = (params.get('status') || '').toLowerCase()
      setStatus('processing')
      setDetail('Processing payment…')

      if (!txRef) {
        setStatus('failed')
        setDetail('Payment was not completed. Missing payment reference. You can try again from your profile.')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('failed')
        setDetail('Please sign in to confirm your payment status.')
        return
      }

      const isFeature = txRef.startsWith('SOKO-FEATURE-')
      setIsFeatureFlow(isFeature)

      // Browser cancel hint — never leave feature pending as active
      if (payStatus === 'cancelled' || payStatus === 'canceled') {
        if (isFeature) {
          await markFeaturePaymentOutcome(txRef, 'cancelled', 'Browser cancelled return')
        } else {
          await cancelVerificationPayment(txRef, user.id)
        }
        setStatus('cancelled')
        setDetail(
          isFeature
            ? 'Payment cancelled. No charge was completed. Your listing was not featured.'
            : 'Payment cancelled. No charge was completed. You can try again anytime.'
        )
        return
      }

      // Source of truth: edge verify (PayChangu) + service-role confirm
      try {
        const result = await Promise.race([
          reconcileVerificationPayment(txRef),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), RECONCILE_TIMEOUT_MS)
          }),
        ])

        if (isFeature) {
          await applyFeatureReconcileResult(result)
          return
        }

        if (result.confirmed) {
          setStatus('success')
          setDetail(
            result.request?.status === 'under_review' || result.request?.status === 'payment_confirmed'
              ? 'Payment successful. Your verification request is now under review — the Verified badge is granted after admin approval.'
              : 'Payment successful. Your verification is being updated for review.'
          )
          return
        }

        const outcome = result.outcome || 'failed'
        if (outcome === 'cancelled') {
          setStatus('cancelled')
          setDetail(result.message || 'Payment cancelled. You can try again.')
          return
        }
        if (outcome === 'expired') {
          setStatus('expired')
          setDetail(result.message || 'Payment expired. You can start a new payment from verification.')
          return
        }
        if (outcome === 'pending') {
          setStatus('processing')
          setDetail('Payment is still processing with the provider. Tap “Check again” in a few seconds.')
          return
        }

        setStatus('failed')
        setDetail(result.message || 'Payment was not completed. You can try again.')
      } catch (e) {
        if (e?.message === 'TIMEOUT') {
          setStatus('failed')
          setDetail(
            'We could not confirm this payment in time. If you were charged, tap “Check again” or contact support — do not pay twice.'
          )
          return
        }
        setStatus('failed')
        setDetail(e?.message || 'Payment was not completed. You can try again.')
      }
    }

    void handle()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single reconcile per return URL mount
  }, [])

  function goRetry() {
    navigate(isFeatureFlow ? '/my-listings' : '/profile')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(circle at 20% 10%, ${C.greenTint} 0%, transparent 45%),
                   radial-gradient(circle at 85% 90%, ${C.amberBg} 0%, transparent 40%),
                   ${C.surface}`,
      padding: 20, fontFamily: DMSANS,
    }}>
      <style>{`
        @keyframes vpSpin { to { transform: rotate(360deg) } }
        @keyframes vpSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @keyframes vpPop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes vpPulseRing { 0% { box-shadow: 0 0 0 0 rgba(26,122,74,0.35) } 100% { box-shadow: 0 0 0 16px rgba(26,122,74,0) } }
      `}</style>

      <div style={{ position: 'fixed', top: 28, left: 32, fontFamily: SORA, fontSize: 20, fontWeight: 800 }}>
        <span style={{ color: C.green }}>Soko</span><span style={{ color: C.gold }}>Mw</span>
      </div>

      {status === 'processing' && (
        <VPCard>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: C.greenTint, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', position: 'relative',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', position: 'absolute',
              animation: 'vpPulseRing 1.6s ease-out infinite',
            }} />
            <div style={{
              width: 30, height: 30, border: `3px solid ${C.greenLight}`,
              borderTopColor: C.green, borderRadius: '50%',
              animation: 'vpSpin 0.8s linear infinite',
            }} />
          </div>
          <div style={{ fontFamily: SORA, fontSize: 17, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
            Processing payment…
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
            {detail || "We're verifying this transaction with PayChangu. This only takes a moment."}
          </p>
          <SecondaryButton onClick={recheck} disabled={retrying}>
            {retrying ? 'Checking…' : 'Check again'}
          </SecondaryButton>
        </VPCard>
      )}

      {status === 'success' && (
        <VPCard>
          <IconBadge
            gradient={isFeatureFlow
              ? `linear-gradient(135deg, ${C.amber}, ${C.gold})`
              : `linear-gradient(135deg, ${C.greenMid}, ${C.greenDeep})`}
            glow={isFeatureFlow
              ? '0 10px 28px -8px rgba(217,146,10,0.55)'
              : '0 10px 28px -8px rgba(26,122,74,0.5)'}
          >
            {isFeatureFlow ? Icon.star(34) : Icon.shieldCheck(34)}
          </IconBadge>

          <div style={{ fontFamily: SORA, fontSize: 21, fontWeight: 800, color: C.dark, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {isFeatureFlow ? 'Listing Featured!' : 'Payment successful'}
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 26, lineHeight: 1.65 }}>
            {detail || (isFeatureFlow
              ? 'Your listing is now live on the homepage with a gold Featured badge.'
              : 'Thanks! Your payment was confirmed. Your verification request is now under review — you will get the Verified badge after our team approves it.')}
          </p>

          {!isFeatureFlow && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: C.greenTint, border: '1px solid #c9e8d6', borderRadius: 12,
              padding: '10px 14px', marginBottom: 22, fontSize: 12.5, fontWeight: 700, color: C.green,
            }}>
              {Icon.shieldCheck(14, C.green)} Under review — badge after approval
            </div>
          )}

          <PrimaryButton onClick={() => navigate(isFeatureFlow ? '/my-listings' : '/profile')}>
            {isFeatureFlow ? 'View My Listing' : 'Go to Profile'} {Icon.arrowRight(15, '#fff')}
          </PrimaryButton>
        </VPCard>
      )}

      {status === 'cancelled' && (
        <VPCard>
          <IconBadge gradient={`linear-gradient(135deg, ${C.faint}, ${C.muted})`} glow="0 10px 24px -8px rgba(99,112,104,0.35)">
            {Icon.undo(30)}
          </IconBadge>
          <div style={{ fontFamily: SORA, fontSize: 19, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            Payment cancelled
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            {detail || 'No payment was made — nothing was charged. You can try again anytime.'}
          </p>
          <PrimaryButton onClick={goRetry}>
            Try again {Icon.arrowRight(15, '#fff')}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/profile')}>
            Back to Profile
          </SecondaryButton>
        </VPCard>
      )}

      {status === 'expired' && (
        <VPCard>
          <IconBadge gradient={`linear-gradient(135deg, ${C.amber}, ${C.amberDeep})`} glow="0 10px 24px -8px rgba(180,83,9,0.35)">
            {Icon.clock(30)}
          </IconBadge>
          <div style={{ fontFamily: SORA, fontSize: 19, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            Payment expired
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            {detail || 'This payment session expired. Start a new payment from verification — do not pay twice if you already completed one.'}
          </p>
          <PrimaryButton onClick={recheck} disabled={retrying}>
            {retrying ? 'Checking…' : 'Check if payment went through'}
          </PrimaryButton>
          <SecondaryButton onClick={goRetry}>
            Start over
          </SecondaryButton>
        </VPCard>
      )}

      {status === 'failed' && (
        <VPCard>
          <IconBadge gradient={`linear-gradient(135deg, #ef4444, ${C.red})`} glow="0 10px 24px -8px rgba(220,38,38,0.4)">
            {Icon.alert(30)}
          </IconBadge>
          <div style={{ fontFamily: SORA, fontSize: 19, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            Payment failed
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            {detail || 'Payment was not completed. You can try again.'}
          </p>
          <PrimaryButton
            onClick={recheck}
            disabled={retrying || !txRef}
            style={{ background: `linear-gradient(135deg, #ef4444, ${C.red})`, boxShadow: '0 6px 18px -6px rgba(220,38,38,0.4)' }}
          >
            {retrying ? 'Checking…' : 'Check again'}
          </PrimaryButton>
          <SecondaryButton onClick={goRetry}>
            Try payment again
          </SecondaryButton>
        </VPCard>
      )}
    </div>
  )
}
