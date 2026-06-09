// src/components/VouchChainBanner.jsx
export default function VouchChainBanner({ vouchChain, loading }) {
  if (loading) return null
  if (!vouchChain || !vouchChain.degree) return null

  const isDirect = vouchChain.degree === 1
  const connectorName = vouchChain.connector?.full_name || null

  const cfg = isDirect
    ? {
        bg:          'linear-gradient(135deg, #e6f4ec 0%, #d1ead9 100%)',
        border:      '#a3d4b0',
        labelColor:  '#15803d',
        subColor:    '#166534',
        badgeBg:     '#15803d',
        badgeColor:  '#fff',
        icon:        '🛡️',
        label:       'Trusted connection',
        badge:       '1st degree',
        body:        'You have vouched for this seller directly.',
      }
    : {
        bg:          'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border:      '#fcd34d',
        labelColor:  '#b45309',
        subColor:    '#92400e',
        badgeBg:     '#b45309',
        badgeColor:  '#fff',
        icon:        '🔗',
        label:       '2nd-degree connection',
        badge:       '2nd degree',
        body:        connectorName
                       ? null
                       : 'Someone you trust has vouched for this seller.',
      }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: cfg.bg,
      border: `1.5px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '13px 15px',
      marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Icon circle */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: '#fff',
        border: `1.5px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {cfg.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cfg.labelColor, marginBottom: 2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 12, color: cfg.subColor, lineHeight: 1.5, opacity: 0.85 }}>
          {isDirect
            ? cfg.body
            : connectorName
              ? <><span style={{ fontWeight: 700, color: '#0f1410' }}>{connectorName}</span>{' has vouched for this seller.'}</>
              : cfg.body
          }
        </div>
      </div>

      {/* Badge */}
      <div style={{
        background: cfg.badgeBg,
        color: cfg.badgeColor,
        borderRadius: 20, padding: '4px 11px',
        fontSize: 11, fontWeight: 700,
        whiteSpace: 'nowrap', flexShrink: 0,
        letterSpacing: '0.3px',
      }}>
        {cfg.badge}
      </div>
    </div>
  )
}