// src/components/TrustBadge.jsx
export default function TrustBadge({ trustScore, dealCount = 0, size = 'sm' }) {
  const total = trustScore?.total_score ?? 0

  let tier, tierColor, tierBg, tierBorder, tierIcon
  if (total >= 30)      { tier = 'Trusted';  tierColor = '#15803d'; tierBg = '#f0faf4'; tierBorder = '#a3d4b0'; tierIcon = '🛡️' }
  else if (total >= 15) { tier = 'Reliable'; tierColor = '#1a7a4a'; tierBg = '#e6f4ec'; tierBorder = '#b8d8c4'; tierIcon = '✅' }
  else if (total >= 5)  { tier = 'Rising';   tierColor = '#0f766e'; tierBg = '#f0fdfa'; tierBorder = '#99d6cf'; tierIcon = '🔰' }
  else                  { tier = 'New';      tierColor = '#6b7280'; tierBg = '#f3f4f6'; tierBorder = '#e5e7eb'; tierIcon = '🌱' }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: tierBg, border: `1.5px solid ${tierBorder}`,
      borderRadius: 20, padding: '5px 12px 5px 8px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Mini ring */}
      <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" fill="#fff" stroke="#e5e7eb" strokeWidth="2.5" />
          <circle cx="14" cy="14" r="11" fill="none" stroke={tierColor} strokeWidth="2.5"
            strokeDasharray={`${Math.min((total / 30) * 69, 69)} 69`}
            strokeLinecap="round" transform="rotate(-90 14 14)" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: tierColor }}>{Math.round(total)}</span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11 }}>{tierIcon}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: tierColor }}>{tier}</span>
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, marginTop: 0 }}>
          {dealCount} confirmed deal{dealCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}