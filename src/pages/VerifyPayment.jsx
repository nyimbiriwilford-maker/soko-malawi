import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  green: '#1a7a4a', greenMid: '#22a05e', greenDeep: '#0d4a2c',
  greenLight: '#e6f7ee', greenTint: '#f0faf4',
  gold: '#d4920a', amber: '#f59e0b', amberDeep: '#b45309',
  amberBg: '#fffbeb', amberBorder: '#fde68a',
  dark: '#0f1410', muted: '#637068', faint: '#9aafa0',
  border: '#d8e5dc', line: '#e8ede9',
  surface: '#f4f8f5', white: '#ffffff',
  red: '#dc2626', redBg: '#fef2f2', redBorder: '#fecaca',
}
const SORA = "'Sora', system-ui, sans-serif"
const DMSANS = "'DM Sans', system-ui, sans-serif"

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

function PrimaryButton({ children, onClick, style }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: `linear-gradient(135deg, ${C.greenMid}, ${C.greenDeep})`,
        color: C.white, border: 'none', borderRadius: 14,
        padding: '15px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        fontFamily: DMSANS, letterSpacing: '-0.01em',
        boxShadow: hover
          ? '0 10px 24px -6px rgba(26,122,74,0.5)'
          : '0 6px 18px -6px rgba(26,122,74,0.4)',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s ease',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', background: hover ? C.greenTint : C.white,
        border: `1.5px solid ${hover ? C.greenMid : C.border}`,
        borderRadius: 14, padding: '13px 24px', fontSize: 14, fontWeight: 600,
        color: hover ? C.green : '#374151', cursor: 'pointer', fontFamily: DMSANS,
        transition: 'all 0.15s ease', marginTop: 10,
      }}
    >
      {children}
    </button>
  )
}

export default function VerifyPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')
  const [isFeatureFlow, setIsFeatureFlow] = useState(false)

  useEffect(() => {
    handle()
  }, [])

  async function handle() {
    const tx_ref = params.get('tx_ref')
    const payStatus = params.get('status')

    if (!tx_ref) { setStatus('failed'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('failed'); return }

    const isFeature = tx_ref.startsWith('SOKO-FEATURE-')
    setIsFeatureFlow(isFeature)

    if (payStatus === 'cancelled') {
      if (isFeature) {
        await supabase.from('listing_promotions').delete().eq('seller_id', user.id).eq('tx_ref', tx_ref)
      } else {
        await supabase.from('verification_requests').delete().eq('seller_id', user.id).eq('payment_ref', tx_ref)
      }
      setStatus('cancelled')
      return
    }

    const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-transaction', {
      body: { tx_ref },
    })
    if (verifyErr || !verifyData?.confirmed) { setStatus('failed'); return }

    if (isFeature) {
      const { data: confirmData, error: confirmErr } = await supabase.rpc('confirm_feature_payment', { p_tx_ref: tx_ref })
      if (confirmErr || !confirmData) { setStatus('failed'); return }
      setStatus('success')
      return
    }

    const { error, data } = await supabase.from('verification_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('seller_id', user.id)
      .eq('payment_ref', tx_ref)
      .select()

    if (error || !data || data.length === 0) { setStatus('failed'); return }
    setStatus('success')
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

      {/* ── Brand mark ── */}
      <div style={{ position: 'fixed', top: 28, left: 32, fontFamily: SORA, fontSize: 20, fontWeight: 800 }}>
        <span style={{ color: C.green }}>Soko</span><span style={{ color: C.gold }}>Mw</span>
      </div>

      {status === 'checking' && (
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
            Confirming your payment
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            Hang tight — we're verifying this transaction with PayChangu. This only takes a moment.
          </p>
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
            {isFeatureFlow ? 'Listing Featured!' : "You're Verified!"}
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 26, lineHeight: 1.65 }}>
            {isFeatureFlow
              ? 'Your listing is now live on the homepage with a gold Featured badge — get ready for more views.'
              : 'Your seller account is now verified. Your listings will display the Verified Seller badge.'}
          </p>

          {isFeatureFlow && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 12,
              padding: '10px 14px', marginBottom: 22, fontSize: 12.5, fontWeight: 700, color: C.amberDeep,
            }}>
              {Icon.star(14, C.amberDeep)} Featured badge is now live
            </div>
          )}
          {!isFeatureFlow && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: C.greenTint, border: `1px solid #c9e8d6`, borderRadius: 12,
              padding: '10px 14px', marginBottom: 22, fontSize: 12.5, fontWeight: 700, color: C.green,
            }}>
              {Icon.shieldCheck(14, C.green)} Verified Seller badge is now active
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
            Payment Cancelled
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            No payment was made — nothing was charged. You can try again anytime from your profile.
          </p>
          <SecondaryButton onClick={() => navigate('/profile')}>
            Back to Profile
          </SecondaryButton>
        </VPCard>
      )}

      {status === 'failed' && (
        <VPCard>
          <IconBadge gradient={`linear-gradient(135deg, #ef4444, ${C.red})`} glow="0 10px 24px -8px rgba(220,38,38,0.4)">
            {Icon.alert(30)}
          </IconBadge>
          <div style={{ fontFamily: SORA, fontSize: 19, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            Something Went Wrong
          </div>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            We couldn't confirm this payment. If you were charged, please contact support and we'll sort it out.
          </p>
          <PrimaryButton
            onClick={() => navigate('/profile')}
            style={{ background: `linear-gradient(135deg, #ef4444, ${C.red})`, boxShadow: '0 6px 18px -6px rgba(220,38,38,0.4)' }}
          >
            Back to Profile {Icon.arrowRight(15, '#fff')}
          </PrimaryButton>
        </VPCard>
      )}
    </div>
  )
}