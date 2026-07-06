import { T } from '../../constants/tokens'

export function SectionLabel({ label, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 800, color: T.gray900, letterSpacing: '-0.2px' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.gray600, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function ComposerField({ label, children }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: T.gray600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function Divider() {
  return <div style={{ height: 1, background: T.gray100, margin: '20px 0' }} />
}

export function InfoChip({ label, color, bg, border, children }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '8px 10px', border: border ? `1px solid ${border}` : 'none' }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  const bg = toast.type === 'error' ? T.red : toast.type === 'warning' ? T.amber : T.gray900
  return (
    <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', borderRadius: 12, padding: '11px 22px', fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: T.shadowLg, animation: 'badgePop 0.2s ease' }}>
      {toast.msg}
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ display: 'inline-block', width: 26, height: 26, border: `2.5px solid ${T.gray200}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <div style={{ fontSize: 13, color: T.gray600, marginTop: 10 }}>{label}</div>
    </div>
  )
}