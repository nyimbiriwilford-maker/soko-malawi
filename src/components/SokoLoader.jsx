import { useId } from 'react'

export default function SokoLoader({ label = 'Loading…', size = 72, inline = false }) {
  const uid = useId().replace(/:/g, '')
  const g1 = `sk-g1-${uid}`
  const g2 = `sk-g2-${uid}`
  const g3 = `sk-g3-${uid}`

  const baseLabel = label && label.endsWith('…') ? label.slice(0, -1) : label

  const svg = (
    <svg className="soko-mark" width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F9D58" /><stop offset="1" stopColor="#34c77a" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34c77a" /><stop offset="1" stopColor="#0F9D58" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={g3} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F9AB00" /><stop offset="1" stopColor="#ffd05a" />
        </linearGradient>
      </defs>
      <circle className="sk-track" cx="36" cy="36" r="31" fill="none" />
      <g className="sk-inner">
        <circle className="sk-inner-arc" cx="36" cy="36" r="25" fill="none" />
      </g>
      <g className="sk-outer">
        <circle className="sk-seg sk1" cx="36" cy="36" r="31" fill="none" stroke={`url(#${g1})`} />
        <circle className="sk-seg sk2" cx="36" cy="36" r="31" fill="none" stroke={`url(#${g2})`} />
        <circle className="sk-seg sk3" cx="36" cy="36" r="31" fill="none" stroke={`url(#${g3})`} />
      </g>
      <g className="sk-core">
        <circle cx="36" cy="36" r="15" fill="#ffffff" />
        <text x="36" y="42.2" textAnchor="middle" fontFamily="Sora, Inter, system-ui, sans-serif" fontSize="18" fontWeight="800" fill="#0F9D58">S</text>
      </g>
    </svg>
  )

  if (inline) {
    return <span className="soko-inline" role="status" aria-label={label}>{svg}</span>
  }

  if (typeof document !== 'undefined' && document.getElementById('boot-loader')) {
    return null
  }

  return (
    <div className="app-loader soko-stage" role="status" aria-live="polite">
      <div className="soko-glow" aria-hidden="true" />
      {svg}
      {label && (
        <div className="soko-loader-label">
          {baseLabel}
          <span className="soko-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
        </div>
      )}
    </div>
  )
}