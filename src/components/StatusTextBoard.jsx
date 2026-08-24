/**
 * StatusTextBoard — renders a text-only status like a picture:
 * its background colour with the words on top, readable at a glance.
 * Used in story tiles, feed cards, and saved-status banners.
 */
export default function StatusTextBoard({
  color,
  text,
  style = {},
  fontSize = null,
  sizeScale = 1,
  maxLines = 5,
}) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()

  // WhatsApp-style auto sizing: shorter text renders bigger
  const auto = !t
    ? 0
    : t.length <= 12
      ? 22
      : t.length <= 30
        ? 17
        : t.length <= 80
          ? 13.5
          : 11.5
  const size = fontSize || Math.round(auto * sizeScale * 2) / 2

  return (
    <div style={{
      width: '100%', height: '100%',
      background: color || '#0f766e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '14% 10%', boxSizing: 'border-box',
      overflow: 'hidden',
      ...style,
    }}>
      {t ? (
        <p style={{
          margin: 0, maxWidth: '100%',
          fontSize: size, fontWeight: 800, color: '#fff',
          textAlign: 'center', lineHeight: 1.35,
          textShadow: '0 1px 6px rgba(0,0,0,0.35)',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {t}
        </p>
      ) : null}
    </div>
  )
}
