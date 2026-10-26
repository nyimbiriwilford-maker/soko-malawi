import { useId } from 'react'

export default function SokoLoader({ label = 'Loading…', size = 72, inline = false }) {
  const baseLabel = (label || '').replace(/[.…]+$/g, '').trim() || 'Loading'

  const svg = (
    <svg className="soko-mark" width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <circle className="sk-track" cx="36" cy="36" r="31" fill="none" stroke="#0F9D58" strokeOpacity="0.10" strokeWidth="5" />
      <g className="sk-inner">
        <circle className="sk-inner-arc" cx="36" cy="36" r="25" fill="none" stroke="#0F9D58" strokeOpacity="0.28" strokeWidth="1.5" />
      </g>
      <g className="sk-outer">
        <circle className="sk-seg sk1" cx="36" cy="36" r="31" fill="none" stroke="#0F9D58" strokeWidth="5" strokeLinecap="round" />
        <circle className="sk-seg sk2" cx="36" cy="36" r="31" fill="none" stroke="#34c77a" strokeWidth="5" strokeLinecap="round" />
        <circle className="sk-seg sk3" cx="36" cy="36" r="31" fill="none" stroke="#F9AB00" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="sk-core">
        <circle cx="36" cy="36" r="15" fill="#ffffff" />
        <text x="36" y="42.2" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="800" fill="#0F9D58">S</text>
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
    <div className="app-loader soko-stage" role="status" aria-live="polite" style={{ gap: 18 }}>
      <div className="soko-glow" aria-hidden="true" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: 18 }} />
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 6, color: '#0F9D58' }}>
        Soko<span style={{ color: '#F9AB00' }}>Mw</span>
      </div>
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