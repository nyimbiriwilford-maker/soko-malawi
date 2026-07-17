import { useNavigate } from 'react-router-dom'
import useVerificationAttention from '../hooks/useVerificationAttention'

/**
 * Persistent, hard-to-miss home banner when verification needs attention
 * or is under review. Opens Profile verification wizard via query flag.
 */
export default function VerificationAttentionBanner({ userId }) {
  const navigate = useNavigate()
  const { attention, loading } = useVerificationAttention(userId)

  if (loading || !attention?.show) return null

  const needsDocs = attention.persistentAction
    || attention.rawStatus === 'additional_info_required'
    || attention.status === 'additional_info_required'
  const action = needsDocs || attention.actionRequired
  const paid = attention.paymentConfirmed === true
    || attention.paymentLabel === 'Payment confirmed'
    || attention.paymentLabel === 'Completed'
  // Never treat as unpaid action if payment already confirmed
  const showAction = needsDocs || (action && !paid)
  const underReview = !showAction && (
    [
      'under_review', 'payment_confirmed', 'submitted', 'pending',
    ].includes(attention.status)
    || paid
  )

  // Don't clutter home for quiet approved state
  if (attention.status === 'approved' || attention.rawStatus === 'approved') return null

  const bg = showAction
    ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
    : underReview || paid
      ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
      : attention.tone === 'bad'
        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
        : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'

  const border = showAction ? '#fdba74' : (underReview || paid) ? '#93c5fd' : attention.tone === 'bad' ? '#fecaca' : '#fde68a'
  const color = showAction ? '#9a3412' : (underReview || paid) ? '#1d4ed8' : attention.tone === 'bad' ? '#b91c1c' : '#92400e'

  function go() {
    navigate('/profile?verify=1', {
      state: {
        openVerify: true,
        verifyStep: attention.resumeStep || null,
      },
    })
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
      tabIndex={0}
      style={{
        margin: '10px 12px 0',
        borderRadius: 14,
        border: `1.5px solid ${border}`,
        background: bg,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(15,20,16,0.06)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: showAction ? '#fb923c' : (underReview || paid) ? '#3b82f6' : '#f59e0b',
          color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 16,
        }}>
          {showAction ? '!' : (underReview || paid) ? '⏱' : '✓'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
            {needsDocs
              ? 'Verification Pending — Action Required'
              : (paid && !showAction
                ? 'Your verification is currently under review'
                : attention.headline)}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#4b5563', lineHeight: 1.45 }}>
            {needsDocs
              ? (attention.adminMessage
                || attention.detail
                || 'Additional documents are required. Tap to continue verification.')
              : (paid && !showAction
                ? 'Payment confirmed. Your application is being reviewed by our team — no further payment is needed.'
                : (attention.detail
                  || (showAction
                    ? 'Your verification application requires your attention. Click here to continue.'
                    : 'Tap to view your verification status.')))}
          </p>
          {paid && !needsDocs && (
            <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700, color: '#1a7a4a' }}>
              ✓ Payment confirmed
            </p>
          )}
          {paid && needsDocs && (
            <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700, color: '#1a7a4a' }}>
              ✓ Payment already confirmed — upload the requested documents
            </p>
          )}
          {attention.adminMessage && needsDocs && (
            <p style={{
              margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: '#9a3412',
              background: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '8px 10px',
            }}>
              Admin: {attention.adminMessage}
            </p>
          )}
          {needsDocs && attention.missingLabels?.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>
              Missing: {attention.missingLabels.join(', ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go() }}
          style={{
            flexShrink: 0,
            border: 'none',
            borderRadius: 10,
            padding: '9px 12px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: needsDocs ? '#c2410c' : (underReview || paid) ? '#1d4ed8' : '#1a7a4a',
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {needsDocs ? 'Upload documents' : (paid && !showAction ? 'View status' : (attention.ctaLabel || 'Continue'))}
        </button>
      </div>
    </div>
  )
}
