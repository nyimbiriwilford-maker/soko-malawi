import { useState, useRef, useEffect } from 'react'
import { formatDurationLabel } from '../utils/statusVideo'

const G = '#1a7a4a'
const HANDLE_HIT = 48
const HANDLE_VIS_W = 14

export default function Timeline({
  duration,
  start,
  length,
  maxLength,
  minLength = 1,
  disabled,
  currentTime,
  onChange,
  onCommit,
  onSeek,
  thumbnails,
}) {
  const trackRef = useRef(null)
  const scrollRef = useRef(null)
  const dragRef = useRef(null)
  const pendingTimeRef = useRef(null)
  const rafRef = useRef(null)
  const lastCommitRef = useRef({ start, length })
  const [zoom, setZoom] = useState(1)

  const startPct = (start / duration) * 100
  const endPct = ((start + length) / duration) * 100
  const frameDuration = 1 / 30

  function snapToFrame(t) {
    return Math.round(t / frameDuration) * frameDuration
  }

  function timeFromPointer(e) {
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.clientX
    let pct = (clientX - rect.left) / rect.width
    pct = Math.max(0, Math.min(1, pct))
    return pct * duration
  }

  function sendDragResult() {
    if (pendingTimeRef.current == null) return
    const raw = pendingTimeRef.current
    pendingTimeRef.current = null

    if (dragRef.current === 'playhead') {
      const constrained = Math.max(start, Math.min(raw, start + length))
      const snapped = snapToFrame(constrained)
      onSeek?.(snapped)
      autoScroll(constrained / duration * 100)
      return
    }

    let resultStart, resultLength
    if (dragRef.current === 'start') {
      let newStart = Math.max(0, Math.min(raw, start + length - minLength))
      let newLength = Math.min(start + length - newStart, maxLength, duration - newStart)
      resultStart = newStart; resultLength = newLength
      onChange(newStart, newLength)
    } else if (dragRef.current === 'end') {
      let newEnd = Math.max(raw, start + minLength)
      let newLength = Math.min(newEnd - start, maxLength, duration - start)
      resultStart = start; resultLength = newLength
      onChange(start, newLength)
    } else if (dragRef.current === 'move') {
      let halfLen = length / 2
      let newStart = Math.max(0, Math.min(duration - length, raw - halfLen))
      resultStart = newStart; resultLength = length
      onChange(newStart, length)
    }
    if (resultStart != null) lastCommitRef.current = { start: resultStart, length: resultLength }
  }

  function autoScroll(pct) {
    const sc = scrollRef.current
    if (!sc || !trackRef.current) return
    const trackW = trackRef.current.offsetWidth
    const playheadX = (pct / 100) * trackW
    const viewLeft = sc.scrollLeft
    const viewRight = viewLeft + sc.clientWidth
    const margin = sc.clientWidth * 0.1
    if (playheadX < viewLeft + margin) {
      sc.scrollLeft = Math.max(0, playheadX - margin)
    } else if (playheadX > viewRight - margin) {
      sc.scrollLeft = Math.min(sc.scrollWidth - sc.clientWidth, playheadX - sc.clientWidth + margin)
    }
  }

  function scheduleDrag(e) {
    pendingTimeRef.current = timeFromPointer(e)
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        sendDragResult()
      })
    }
  }

  function handlePointerDown(e) {
    const handle = e.currentTarget.dataset.handle
    if (!handle || disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = handle
    scheduleDrag(e)
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    e.preventDefault()
    scheduleDrag(e)
  }

  function handlePointerUp() {
    if (!dragRef.current) return
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    sendDragResult()
    const wasPlayhead = dragRef.current === 'playhead'
    dragRef.current = null
    pendingTimeRef.current = null
    if (!wasPlayhead) {
      const c = lastCommitRef.current
      onCommit?.(snapToFrame(c.start), snapToFrame(c.length))
    }
  }

  function handleTrackClick(e) {
    if (disabled) return
    if (dragRef.current) return
    const t = timeFromPointer(e)
    onSeek?.(snapToFrame(t))
  }

  useEffect(() => {
    return () => {
      dragRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function handleZoomIn() {
    const next = Math.min(zoom * 1.5, 8)
    if (next === zoom) return
    const sc = scrollRef.current
    const centerPct = sc ? (sc.scrollLeft + sc.clientWidth / 2) / (sc.scrollWidth || 1) : 0.5
    setZoom(next)
    requestAnimationFrame(() => {
      if (!sc) return
      const newLeft = centerPct * sc.scrollWidth - sc.clientWidth / 2
      sc.scrollLeft = Math.max(0, Math.min(newLeft, sc.scrollWidth - sc.clientWidth))
    })
  }

  function handleZoomOut() {
    const next = Math.max(zoom / 1.5, 0.5)
    if (next === zoom) return
    const sc = scrollRef.current
    const centerPct = sc ? (sc.scrollLeft + sc.clientWidth / 2) / (sc.scrollWidth || 1) : 0.5
    setZoom(next)
    requestAnimationFrame(() => {
      if (!sc) return
      const newLeft = centerPct * sc.scrollWidth - sc.clientWidth / 2
      sc.scrollLeft = Math.max(0, Math.min(newLeft, sc.scrollWidth - sc.clientWidth))
    })
  }

  const playheadPct = currentTime != null ? (currentTime / duration) * 100 : null

  const thumbsPerPct = thumbnails.length > 0 ? 100 / thumbnails.length : 0
  const showThumbs = thumbnails.length > 0 && zoom >= 0.8

  return (
    <div style={{ userSelect: 'none', touchAction: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 0.3 }}>
          TRIM
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
            {formatDurationLabel(start)}
            <span style={{ color: '#94a3b8', fontWeight: 600 }}> → </span>
            {formatDurationLabel(start + length)}
          </span>
          {currentTime != null && (
            <span style={{ fontSize: 11, color: G, fontWeight: 700, background: '#f0fdf4', padding: '1px 6px', borderRadius: 6 }}>
              {formatDurationLabel(currentTime)}
            </span>
          )}
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              style={{
                width: 26, height: 26, borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, lineHeight: 1,
                opacity: zoom <= 0.5 ? 0.4 : 1,
              }}
              title="Zoom out"
            >−</button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 8}
              style={{
                width: 26, height: 26, borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, lineHeight: 1,
                opacity: zoom >= 8 ? 0.4 : 1,
              }}
              title="Zoom in"
            >+</button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto', overflowY: 'hidden',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          background: '#0f172a',
          touchAction: 'pan-x',
        }}
      >
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'relative',
            height: 52,
            width: `${Math.max(100, 100 * zoom)}%`,
            cursor: disabled ? 'default' : 'pointer',
            touchAction: 'none',
          }}
        >
          {/* Thumbnail strip */}
          {showThumbs && thumbnails.map((th, i) => (
            <img
              key={i}
              src={th.url}
              alt=""
              style={{
                position: 'absolute', top: 0, left: `${(th.time / duration) * 100}%`,
                width: `${thumbsPerPct}%`, height: 52,
                objectFit: 'cover', pointerEvents: 'none',
              }}
            />
          ))}

          {/* Non-selected regions (dimmed) */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: `${Math.max(0, startPct)}%`,
            background: 'rgba(0,0,0,0.55)',
            borderRadius: '10px 0 0 10px',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: `${Math.max(0, 100 - endPct)}%`,
            background: 'rgba(0,0,0,0.55)',
            borderRadius: '0 10px 10px 0',
            zIndex: 1,
            pointerEvents: 'none',
          }} />

          {/* Tick marks */}
          {Array.from({ length: Math.min(Math.ceil(duration), 60) }, (_, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(i / duration) * 100}%`,
              width: 1,
              background: i % 5 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              zIndex: 1,
              pointerEvents: 'none',
            }} />
          ))}

          {/* Selected range (move handle) */}
          <div
            data-handle="move"
            onPointerDown={handlePointerDown}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${startPct}%`,
              width: `calc(${endPct - startPct}% + 0px)`,
              border: `2px solid ${G}`, boxSizing: 'border-box',
              cursor: disabled ? 'default' : 'grab',
              background: 'rgba(26,122,74,0.15)',
              zIndex: 2,
              touchAction: 'none',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: 2, background: G, opacity: 0.5, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 2, background: G, opacity: 0.5, pointerEvents: 'none',
            }} />
          </div>

          {/* Draggable Playhead */}
          {playheadPct != null && (
            <div
              data-handle="playhead"
              onPointerDown={handlePointerDown}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `calc(${playheadPct}% - 20px)`,
                width: 40,
                cursor: disabled ? 'default' : 'pointer',
                zIndex: 5,
                touchAction: 'none',
              }}
            >
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: 19, width: 2,
                background: '#fff',
                boxShadow: '0 0 4px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', top: -4, left: 15,
                width: 10, height: 10, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }} />
            </div>
          )}

          {/* Start handle hit zone (expanded) */}
          <div
            data-handle="start"
            onPointerDown={handlePointerDown}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `calc(${startPct}% - ${HANDLE_HIT / 2}px)`,
              width: HANDLE_HIT,
              cursor: disabled ? 'default' : 'ew-resize',
              zIndex: 4,
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: HANDLE_VIS_W, height: '100%',
              borderRadius: '0 4px 4px 0',
              background: G,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ width: 2, height: 24, borderRadius: 2, background: '#fff', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* End handle hit zone (expanded) */}
          <div
            data-handle="end"
            onPointerDown={handlePointerDown}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `calc(${endPct}% - ${HANDLE_HIT / 2}px)`,
              width: HANDLE_HIT,
              cursor: disabled ? 'default' : 'ew-resize',
              zIndex: 4,
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: HANDLE_VIS_W, height: '100%',
              borderRadius: '4px 0 0 4px',
              background: G,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ width: 2, height: 24, borderRadius: 2, background: '#fff', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
