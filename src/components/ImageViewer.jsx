import { useEffect, useRef, useState } from 'react'
import { Icon } from './LookingFor/Icons'

export default function ImageViewer({ photos, index, onChange, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const startXRef = useRef(null)
  const lastTapRef = useRef(0)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && photos.length > 1) onChange((index + 1) % photos.length)
      else if (e.key === 'ArrowLeft' && photos.length > 1) onChange((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [index, photos.length, onChange, onClose])

  function go(delta) {
    if (photos.length <= 1) return
    onChange((index + delta + photos.length) % photos.length)
  }

  function onTouchStart(e) {
    startXRef.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e) {
    const start = startXRef.current
    const end = e.changedTouches[0]?.clientX
    startXRef.current = null
    if (start == null || end == null) return
    const dx = end - start
    if (Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1)
      lastTapRef.current = 0
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setZoom(z => !z)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <button type="button" aria-label="Close image viewer" onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: '50%',
          border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
        }}>
        {Icon.x(20, '#fff')}
      </button>
      {photos.length > 1 && (
        <div style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          color: '#fff', fontSize: 14, fontWeight: 800, zIndex: 2,
        }}>
          {index + 1} / {photos.length}
        </div>
      )}
      {photos.length > 1 && (
        <>
          <button type="button" className="lf-viewer-arrow" aria-label="Previous image" onClick={() => go(-1)}
            style={{ left: 16 }}><span>‹</span></button>
          <button type="button" className="lf-viewer-arrow" aria-label="Next image" onClick={() => go(1)}
            style={{ right: 16 }}><span>›</span></button>
        </>
      )}
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 16px 92px' }}>
        {failed ? (
          <div style={{
            width: 'min(80vw, 420px)', height: 'min(50vh, 280px)', borderRadius: 16,
            background: '#9aa0a6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700,
          }}>Image unavailable</div>
        ) : (
          <>
            {!loaded && <div className="lf-viewer-spinner" />}
            <img
              src={photos[index]}
              alt=""
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              onDoubleClick={() => setZoom(z => !z)}
              style={{
                maxWidth: '100vw', maxHeight: '100vh', width: '100%', height: '100%',
                objectFit: 'contain', display: 'block',
                opacity: loaded ? 1 : 0,
                transform: zoom ? 'scale(1.8)' : 'scale(1)',
                transition: 'transform 0.18s ease, opacity 0.18s ease',
                touchAction: 'pinch-zoom', cursor: zoom ? 'zoom-out' : 'zoom-in',
              }}
            />
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, maxWidth: '92vw', overflowX: 'auto', zIndex: 2,
        }}>
          {photos.map((url, i) => (
            <button key={url + i} type="button" aria-label={`View image ${i + 1}`} onClick={() => onChange(i)}
              style={{
                width: 48, height: 48, flexShrink: 0, borderRadius: 8, padding: 0, overflow: 'hidden',
                border: i === index ? '2px solid #0F9D58' : '2px solid rgba(255,255,255,0.45)',
                background: '#f1f3f4', cursor: 'pointer',
              }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
