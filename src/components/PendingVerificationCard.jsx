import useVerificationAttention from '../hooks/useVerificationAttention'
import { statusLabel, paymentStatusLabel } from '../lib/verification'

/**
 * Rich pending verification card for Profile (and optional Home).
 * Shows status, admin message, doc checklist, payment, CTAs.
 */
export default function PendingVerificationCard({
  userId,
  isVerified = false,
  onContinue,
  compact = false,
}) {
  const { attention, loading } = useVerificationAttention(userId)

  if (loading) return null
  if (!attention?.show && !isVerified) {
    // Offer start path when no active request
    return null
  }
  if (isVerified && attention?.status === 'approved' && !compact) {
    return (
      <div style={card(true)}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1a7a4a', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Verification status
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6, color: '#0f1410' }}>Approved</div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#637068' }}>
          Your verified badge is active. Buyers can trust your identity on SokoMw.
        </p>
      </div>
    )
  }
  if (!attention?.show) return null

  const a = attention
  const action = a.actionRequired || a.persistentAction

  return (
    <div style={card(a.tone === 'ok', action, a.tone === 'bad')} role="region" aria-label="Verification status">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
            background: action ? '#ffedd5' : a.tone === 'bad' ? '#fee2e2' : '#fef3c7',
            color: action ? '#c2410c' : a.tone === 'bad' ? '#b91c1c' : '#b45309',
            marginBottom: 8,
          }}>
            {a.persistentAction ? 'Action required' : a.statusMeta?.label || statusLabel(a.status)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>{a.headline}</div>
          {a.detail && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4b5563', lineHeight: 1.45 }}>{a.detail}</p>
          )}
        </div>
        {onContinue && (
          <button type="button" onClick={onContinue} style={ctaBtn(action)}>
            {a.ctaLabel || 'Continue verification'}
          </button>
        )}
      </div>

      {!compact && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}>
          <Meta label="Type" value={a.typeName} />
          <Meta label="Submitted" value={fmt(a.submittedAt)} />
          <Meta label="Review time" value={a.estimate || '—'} />
          <Meta label="Payment" value={a.paymentLabel || paymentStatusLabel(a.payments?.[0]?.payment_status) || '—'} />
          <Meta label="Fee" value={a.feeLabel || '—'} />
        </div>
      )}

      {a.adminMessage && (
        <div style={{
          marginTop: 14,
          background: action ? '#fff7ed' : '#f9fafb',
          border: `1px solid ${action ? '#fed7aa' : '#e5e7eb'}`,
          borderRadius: 12,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Admin message
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7c2d12', lineHeight: 1.45 }}>
            {a.adminMessage}
          </p>
        </div>
      )}

      {a.docChecklist?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Required documents
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {a.docChecklist.map((d) => (
              <li
                key={d.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: d.uploaded ? '#e8f5ee' : '#f9fafb',
                  color: d.uploaded ? '#1a7a4a' : '#6b7280',
                  fontWeight: d.uploaded ? 700 : 500,
                }}
              >
                <span aria-hidden="true">{d.uploaded ? '✓' : '○'}</span>
                {d.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700 }}>
                  {d.uploaded ? 'Uploaded' : 'Missing'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onContinue && !compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onContinue} style={ctaBtn(action)}>
            {a.ctaLabel || 'Continue verification'}
          </button>
          {a.missingLabels?.length > 0 && (
            <button
              type="button"
              onClick={onContinue}
              style={{ ...ctaBtn(false), background: '#fff', color: '#1a7a4a', border: '1.5px solid #a7f3d0' }}
            >
              Upload documents
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function fmt(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString() } catch { return '—' }
}

function card(ok, action, bad) {
  return {
    borderRadius: 14,
    border: `1px solid ${ok ? '#bbf7d0' : action ? '#fdba74' : bad ? '#fecaca' : '#e8f0ec'}`,
    background: ok ? '#f0faf4' : action ? '#fffbeb' : bad ? '#fef2f2' : '#fff',
    padding: '14px 16px',
    marginBottom: 14,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  }
}

function ctaBtn(action) {
  return {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: action ? '#c2410c' : '#1a7a4a',
    color: '#fff',
  }
}
