

function ShimmerBlock({ className = '', style = {} }) {
  return <div className={`sk-shimmer ${className}`} style={style} aria-hidden="true" />
}

export function StatusRailSkeleton() {
  return (
    <div className="hs-rail-wrap" style={{ position: 'relative', padding: 0, margin: 0 }} aria-busy="true" aria-live="polite">
      <span className="sk-sr-only">Loading</span>
      <div className="hs-rail" style={{ display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', scrollPaddingLeft: '14px' }}>
        <button type="button" className="hs-add-btn" style={{ flexShrink: 0, cursor: 'pointer', padding: 14, fontFamily: 'inherit', textAlign: 'center', background: '#ffffff', scrollSnapAlign: 'start', border: '1.5px dashed rgba(15,157,88,0.45)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, boxSizing: 'border-box' }}>
          <div className="hs-create-plus" style={{ width: 44, height: 44, borderRadius: '50%', background: '#0F9D58', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(15,157,88,0.28)' }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#202124', letterSpacing: -0.2 }}>Create Status</div>
        </button>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="hs-story-btn sk-dark" style={{ flexShrink: 0, position: 'relative', border: 'none', padding: 0, fontFamily: 'inherit', textAlign: 'left', background: '#111', scrollSnapAlign: 'start', borderRadius: 16, overflow: 'hidden', aspectRatio: '9 / 14', width: 148 }}>
            <ShimmerBlock className="sk-shimmer--dark" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', top: 12, left: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', bottom: 24, left: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ShimmerBlock className="sk-shimmer--dark" style={{ width: '55%', height: 10, borderRadius: 6 }} />
              <ShimmerBlock className="sk-shimmer--dark" style={{ width: '35%', height: 10, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CategoryRailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sk-sr-only">Loading</span>
      <ShimmerBlock style={{ width: 160, height: 22, borderRadius: 6, marginBottom: 6 }} />
      <ShimmerBlock style={{ width: 220, height: 13, borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ShimmerBlock style={{ width: 44, height: 44, borderRadius: 12 }} />
            <ShimmerBlock style={{ width: '60%', height: 10, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListingGridSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sk-sr-only">Loading</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e8eaed' }}>
            <ShimmerBlock style={{ width: '100%', aspectRatio: '4 / 3' }} />
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ShimmerBlock style={{ width: '85%', height: 12, borderRadius: 6 }} />
              <ShimmerBlock style={{ width: '40%', height: 12, borderRadius: 6 }} />
              <ShimmerBlock style={{ width: '55%', height: 10, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeSkeleton() {
  return (
    <>
      <StatusRailSkeleton />
      <CategoryRailSkeleton />
      <ListingGridSkeleton />
    </>
  )
}