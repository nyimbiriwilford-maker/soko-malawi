export default function SokoLoader({ label = 'Loading' }) {
  const baseLabel = (label || '').replace(/[.…]+$/g, '').trim() || 'Loading'

  return (
    <div className="app-loader soko-stage" role="status" aria-live="polite" style={{ gap: 18 }}>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 6, color: '#0F9D58' }}>
        Soko<span style={{ color: '#F9AB00' }}>Mw</span>
      </div>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <div className="soko-glow" aria-hidden="true" style={{ position: 'absolute', inset: '-74px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,157,88,0.14) 0%, rgba(15,157,88,0) 68%)', animation: 'skGlow 2.4s ease-in-out infinite', pointerEvents: 'none' }} />
        <svg className="soko-mark" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle className="sk-track" cx="36" cy="36" r="31" fill="none" stroke="#0F9D58" strokeOpacity={0.10} strokeWidth="5" strokeLinecap="round" />
          <g className="sk-inner">
            <circle className="sk-inner-arc" cx="36" cy="36" r="25" fill="none" stroke="#0F9D58" strokeOpacity={0.28} strokeWidth="1.5" strokeLinecap="round" />
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
      </div>
      {label && (
        <div className="soko-loader-label">
          {baseLabel}
          <span className="soko-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
        </div>
      )}
    </div>
  )
}
