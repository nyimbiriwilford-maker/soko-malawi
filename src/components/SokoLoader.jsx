export default function SokoLoader({ label = 'Loading…', size = 56, inline = false }) {
  const ring = (
    <svg className="soko-ring" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle className="soko-seg s1" cx="32" cy="32" r="22" />
      <circle className="soko-seg s2" cx="32" cy="32" r="22" />
      <circle className="soko-seg s3" cx="32" cy="32" r="22" />
    </svg>
  )

  if (inline) {
    return (
      <span className="soko-loader-inline" role="status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: label ? 8 : 0 }}>
        {ring}
        {label && <span className="soko-loader-label">{label}</span>}
      </span>
    )
  }

  return (
    <div className="app-loader" role="status" aria-live="polite">
      {ring}
      {label && <div className="soko-loader-label">{label}</div>}
    </div>
  )
}