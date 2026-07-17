import { useEffect, useState } from 'react'
import {
  getLatestVerificationRequest,
  getSellerVerificationStatusMeta,
  getVerificationSettings,
  VERIFICATION_STATUSES,
  statusLabel,
} from '../lib/verification'

/**
 * Seller-facing verification status card for Profile / Trust Center.
 * Opens existing VerificationWizard via onContinue (does not rebuild wizard).
 */
export default function SellerVerificationBanner({ userId, isVerified, onContinue }) {
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(!!userId)
  const [systemEnabled, setSystemEnabled] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const [latest, settings] = await Promise.all([
          getLatestVerificationRequest(userId),
          getVerificationSettings().catch(() => null),
        ])
        if (!cancelled) {
          setRequest(latest)
          setSystemEnabled(settings?.is_enabled !== false)
        }
      } catch {
        if (!cancelled) setRequest(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  if (loading) return null

  if (!systemEnabled && !isVerified) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: '1px solid #fde68a',
          background: '#fffbeb',
          padding: '14px 16px',
          marginBottom: 14,
        }}
        role="status"
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: '#b45309' }}>
          Verification services are temporarily unavailable.
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#92400e' }}>
          Please check back later. You cannot start a new verification request right now.
        </p>
      </div>
    )
  }

  const status = isVerified
    ? VERIFICATION_STATUSES.APPROVED
    : (request?.status || 'none')
  const meta = getSellerVerificationStatusMeta(status)
  const needsInfo = status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
  const inProgress = [
    VERIFICATION_STATUSES.DRAFT,
    VERIFICATION_STATUSES.PAYMENT_PENDING,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.SUBMITTED,
    VERIFICATION_STATUSES.UNDER_REVIEW,
    'pending',
  ].includes(status)

  const canContinue = systemEnabled && (
    needsInfo
    || status === VERIFICATION_STATUSES.DRAFT
    || status === VERIFICATION_STATUSES.PAYMENT_PENDING
    || (!isVerified && !request)
  )

  // When a full PendingVerificationCard is shown for active requests, skip this slim banner
  // except for "start verification" / disabled system / pure needs-info CTA.
  const showStartCta = systemEnabled && !isVerified && !request
  if (request && !needsInfo && !showStartCta) {
    return null
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${needsInfo ? '#fdba74' : meta.bg === '#e6f4ec' ? '#bbf7d0' : '#e8f0ec'}`,
        background: needsInfo ? '#fff7ed' : meta.bg,
        padding: '14px 16px',
        marginBottom: 14,
      }}
      role="status"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 6,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: meta.color,
            }} />
            {meta.label}
          </div>

          {needsInfo ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#9a3412', marginBottom: 6 }}>
                Your verification needs more information
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#9a3412', lineHeight: 1.45 }}>
                {request?.additional_info_message
                  || 'Please update your application with the documents or details requested by our team.'}
              </p>
              {(request?.reviewed_at || request?.updated_at || request?.created_at) && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#c2410c' }}>
                  Requested{' '}
                  {new Date(request.reviewed_at || request.updated_at || request.created_at).toLocaleString()}
                </p>
              )}
            </>
          ) : isVerified || status === VERIFICATION_STATUSES.APPROVED ? (
            <p style={{ margin: 0, fontSize: 13, color: '#1a7a4a', fontWeight: 600 }}>
              Identity verified — buyers can trust your profile.
            </p>
          ) : status === VERIFICATION_STATUSES.REJECTED ? (
            <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', lineHeight: 1.45 }}>
              {request?.rejection_reason || 'Your verification was not approved.'}
            </p>
          ) : inProgress ? (
            <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.45 }}>
              {status === VERIFICATION_STATUSES.DRAFT
                ? 'You have a draft application. Continue when you are ready.'
                : status === VERIFICATION_STATUSES.PAYMENT_PENDING
                  ? 'Payment is pending confirmation.'
                  : 'Your application is under review. We will notify you when a decision is made.'}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.45 }}>
              Get verified to sell faster and earn more trust.
            </p>
          )}

          {request && !needsInfo && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
              Status: {statusLabel(request.status)}
              {request.updated_at ? ` · Updated ${new Date(request.updated_at).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>

        {canContinue && (
          <button
            type="button"
            onClick={() => onContinue?.()}
            style={{
              flexShrink: 0,
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: needsInfo ? '#c2410c' : '#1a7a4a',
              color: '#fff',
            }}
          >
            {needsInfo
              ? 'Continue verification'
              : request
                ? 'Continue verification'
                : 'Get verified'}
          </button>
        )}
      </div>
    </div>
  )
}
