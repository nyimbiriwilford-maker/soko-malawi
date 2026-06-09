// Read-only badge — shown on listing cards, listing detail, profile views
// Props: status (object from user_statuses) | compact (bool)

export default function StatusBadge({ status, compact = false }) {
  if (!status) return null

  const isUrgent =
    status.content?.toLowerCase().includes('price drop') ||
    status.content?.toLowerCase().includes('price dropped') ||
    status.content?.toLowerCase().includes('two people') ||
    status.content?.toLowerCase().includes('first to confirm') ||
    status.status_type === 'listing_urgency'

  const bg     = isUrgent ? '#fff8e1' : '#e8f5e9'
  const color  = isUrgent ? '#e65100' : '#2e7d32'
  const border = isUrgent ? '#ffe082' : '#a5d6a7'
  const dot    = isUrgent ? '#f9a825' : '#2e7d32'

  // Time left label
  const msLeft = new Date(status.expires_at) - Date.now()
  let timeLabel = ''
  if (msLeft > 0) {
    const h = Math.floor(msLeft / 3600000)
    const m = Math.floor((msLeft % 3600000) / 60000)
    timeLabel = h >= 1 ? `${h}h left` : `${m}m left`
  }

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: bg, color, border: `1px solid ${border}`,
        borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
        whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        {status.content}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 12, padding: '10px 12px',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: dot, flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1.4 }}>
          {status.content}
        </div>
        {timeLabel && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            ⏱ {timeLabel}
          </div>
        )}
      </div>
    </div>
  )
}