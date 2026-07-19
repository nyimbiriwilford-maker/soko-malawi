import { useState, useEffect } from 'react'

/**
 * Avatar that never shows a broken image icon.
 * Falls back to initials on missing/invalid URLs or load errors.
 */
export default function SafeAvatar({
  url,
  name = 'User',
  size = 40,
  radius = '50%',
  fontSize,
  className = '',
  style = {},
  isMine = false,
}) {
  const [failed, setFailed] = useState(false)
  const cleanUrl = typeof url === 'string' && url.trim() && url !== 'null' && url !== 'undefined'
    ? url.trim()
    : null

  useEffect(() => {
    setFailed(false)
  }, [cleanUrl])

  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U'
  const showImg = cleanUrl && !failed
  const bg = showImg
    ? '#eef2ef'
    : isMine
      ? 'linear-gradient(135deg,#22a05e,#1a7a4a)'
      : 'linear-gradient(135deg,#4f7cff,#2563eb)'

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={cleanUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: fontSize || Math.max(11, size * 0.38),
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {initial}
        </span>
      )}
    </div>
  )
}
