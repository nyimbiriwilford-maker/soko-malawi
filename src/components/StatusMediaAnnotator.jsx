/**
 * StatusMediaAnnotator — hide text / faces with blur brushes,
 * draw pens, arrows, and pointer stickers on photo or video (overlay).
 */
import { useEffect, useRef, useState, useCallback } from 'react'

const TOOLS = [
  { id: 'blur', label: 'Soft blur', hint: 'Hide words gently' },
  { id: 'blurStrong', label: 'Heavy blur', hint: 'Strong hide' },
  { id: 'pixel', label: 'Pixelate', hint: 'Blocky censor' },
  { id: 'pen', label: 'Pen', hint: 'Draw freehand' },
  { id: 'arrow', label: 'Arrow', hint: 'Point at something' },
  { id: 'pointer', label: 'Stickers', hint: 'Tap to place' },
  { id: 'eraser', label: 'Eraser', hint: 'Remove marks' },
]

const PEN_COLORS = ['#ffffff', '#F9AB00', '#0F9D58', '#ea4335', '#1A73E8', '#000000']
const POINTERS = ['👆', '👇', '👉', '👈', '➡️', '⭐', '🔥', '✅', '❌', '👀', '💯', '📍']
const BRUSH_SIZES = [18, 28, 42, 60]

const G = '#0F9D58'

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * @param {object} props
 * @param {string} props.src - blob or url preview
 * @param {'image'|'video'} props.mediaType
 * @param {() => void} props.onClose
 * @param {(result: { mode: 'baked'|'overlay', file: File, previewUrl: string }) => void} props.onApply
 */
export default function StatusMediaAnnotator({ src, mediaType = 'image', onClose, onApply }) {
  const wrapRef = useRef(null)
  const displayRef = useRef(null) // canvas shown to user
  const baseRef = useRef(null) // original pixels (image) or null for video
  const blurSoftRef = useRef(null)
  const blurHardRef = useRef(null)
  const pixelRef = useRef(null)
  const marksRef = useRef(null) // freehand + stickers + arrows (vector redraw)
  const videoRef = useRef(null)

  const [tool, setTool] = useState('blur')
  const [brush, setBrush] = useState(28)
  const [penColor, setPenColor] = useState('#ffffff')
  const [pointerEmoji, setPointerEmoji] = useState('👆')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')

  // Vector state for non-blur strokes (so undo works cleanly)
  const [strokes, setStrokes] = useState([]) // {type, ...}
  const drawingRef = useRef(null) // in-progress stroke
  const [history, setHistory] = useState([]) // snapshots of { strokes, blurData }
  const blurLayerRef = useRef(null) // offscreen canvas for blur stamps only

  const W = useRef(0)
  const H = useRef(0)

  const rebuildFilters = useCallback((base, w, h) => {
    // Soft blur
    const soft = document.createElement('canvas')
    soft.width = w
    soft.height = h
    const sctx = soft.getContext('2d')
    sctx.filter = 'blur(14px)'
    sctx.drawImage(base, 0, 0, w, h)
    sctx.filter = 'none'
    blurSoftRef.current = soft

    // Heavy blur
    const hard = document.createElement('canvas')
    hard.width = w
    hard.height = h
    const hctx = hard.getContext('2d')
    hctx.filter = 'blur(28px)'
    hctx.drawImage(base, 0, 0, w, h)
    hctx.filter = 'none'
    blurHardRef.current = hard

    // Pixelate
    const pixel = document.createElement('canvas')
    pixel.width = w
    pixel.height = h
    const pctx = pixel.getContext('2d')
    const scale = Math.max(8, Math.round(Math.min(w, h) / 48))
    const tiny = document.createElement('canvas')
    tiny.width = Math.max(1, Math.floor(w / scale))
    tiny.height = Math.max(1, Math.floor(h / scale))
    const tctx = tiny.getContext('2d')
    tctx.imageSmoothingEnabled = false
    tctx.drawImage(base, 0, 0, tiny.width, tiny.height)
    pctx.imageSmoothingEnabled = false
    pctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, w, h)
    pixelRef.current = pixel
  }, [])

  const paintAll = useCallback(() => {
    const canvas = displayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = W.current
    const h = H.current
    ctx.clearRect(0, 0, w, h)

    // Base media
    if (baseRef.current) {
      ctx.drawImage(baseRef.current, 0, 0, w, h)
    } else if (videoRef.current) {
      try {
        ctx.drawImage(videoRef.current, 0, 0, w, h)
      } catch { /* video not ready */ }
    }

    // Blur / pixel stamps
    if (blurLayerRef.current) {
      ctx.drawImage(blurLayerRef.current, 0, 0)
    }

    // Vector marks
    const list = [...strokes]
    if (drawingRef.current) list.push(drawingRef.current)
    for (const s of list) {
      if (s.type === 'pen' && s.points?.length > 1) {
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
        ctx.stroke()
      } else if (s.type === 'arrow' && s.from && s.to) {
        drawArrow(ctx, s.from, s.to, s.color, s.size)
      } else if (s.type === 'pointer' && s.at) {
        ctx.font = `${s.size * 1.6}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.emoji, s.at.x, s.at.y)
      }
    }
  }, [strokes])

  useEffect(() => {
    paintAll()
  }, [paintAll, strokes])

  // Load media into canvases
  useEffect(() => {
    if (!src) return
    let cancelled = false
    setReady(false)
    setError('')
    setStrokes([])
    drawingRef.current = null

    async function initImage(url) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = () => rej(new Error('Could not load image'))
        img.src = url
      })
      if (cancelled) return

      const maxSide = 1280
      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      const scale = Math.min(1, maxSide / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      W.current = w
      H.current = h

      const base = document.createElement('canvas')
      base.width = w
      base.height = h
      base.getContext('2d').drawImage(img, 0, 0, w, h)
      baseRef.current = base
      rebuildFilters(base, w, h)

      const blurLayer = document.createElement('canvas')
      blurLayer.width = w
      blurLayer.height = h
      blurLayerRef.current = blurLayer

      const display = displayRef.current
      if (display) {
        display.width = w
        display.height = h
      }
      setSizeLabel(`${w}×${h}`)
      setReady(true)
      requestAnimationFrame(() => paintAll())
    }

    async function initVideo(url) {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      video.src = url
      await new Promise((res, rej) => {
        video.onloadeddata = () => res()
        video.onerror = () => rej(new Error('Could not load video'))
        setTimeout(() => res(), 6000)
      })
      if (cancelled) return
      videoRef.current = video
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) * 0.05)
        await new Promise((r) => {
          video.onseeked = () => r()
          setTimeout(r, 800)
        })
      } catch { /* ignore */ }

      const maxSide = 1280
      let w = video.videoWidth || 720
      let h = video.videoHeight || 1280
      const scale = Math.min(1, maxSide / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      W.current = w
      H.current = h

      // Snapshot frame as base for blur sampling
      const base = document.createElement('canvas')
      base.width = w
      base.height = h
      try {
        base.getContext('2d').drawImage(video, 0, 0, w, h)
      } catch {
        base.getContext('2d').fillStyle = '#111'
        base.getContext('2d').fillRect(0, 0, w, h)
      }
      baseRef.current = base
      rebuildFilters(base, w, h)

      const blurLayer = document.createElement('canvas')
      blurLayer.width = w
      blurLayer.height = h
      blurLayerRef.current = blurLayer

      const display = displayRef.current
      if (display) {
        display.width = w
        display.height = h
      }
      setSizeLabel(`${w}×${h}`)
      setReady(true)
      requestAnimationFrame(() => paintAll())
    }

    ;(async () => {
      try {
        if (mediaType === 'video') await initVideo(src)
        else await initImage(src)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to open media')
      }
    })()

    return () => { cancelled = true }
  }, [src, mediaType, rebuildFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  function canvasPoint(e) {
    const canvas = displayRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches?.[0]?.clientX ?? e.clientX
    const clientY = e.touches?.[0]?.clientY ?? e.clientY
    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height
    return { x, y }
  }

  function stampBlur(pt, kind) {
    const layer = blurLayerRef.current
    if (!layer) return
    const ctx = layer.getContext('2d')
    const r = brush / 2
    let source = blurSoftRef.current
    if (kind === 'blurStrong') source = blurHardRef.current
    if (kind === 'pixel') source = pixelRef.current
    if (!source) return

    ctx.save()
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(source, 0, 0)
    ctx.restore()

    // Soft edge for blur tools
    if (kind !== 'pixel') {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      const g = ctx.createRadialGradient(pt.x, pt.y, r * 0.35, pt.x, pt.y, r)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      // Apply feather via separate pass — simpler: leave hard clip for performance
      ctx.restore()
    }
  }

  function stampEraser(pt) {
    const layer = blurLayerRef.current
    if (!layer) return
    const ctx = layer.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, brush / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function pushHistory() {
    const blurLayer = blurLayerRef.current
    let blurData = null
    try {
      blurData = blurLayer?.toDataURL('image/png')
    } catch { /* ignore */ }
    setHistory(h => [...h.slice(-24), { strokes: JSON.parse(JSON.stringify(strokes)), blurData }])
  }

  function undo() {
    setHistory(h => {
      if (!h.length) return h
      const prev = h[h.length - 1]
      setStrokes(prev.strokes || [])
      if (blurLayerRef.current && prev.blurData) {
        const img = new Image()
        img.onload = () => {
          const ctx = blurLayerRef.current.getContext('2d')
          ctx.clearRect(0, 0, W.current, H.current)
          ctx.drawImage(img, 0, 0)
          paintAll()
        }
        img.src = prev.blurData
      } else if (blurLayerRef.current) {
        blurLayerRef.current.getContext('2d').clearRect(0, 0, W.current, H.current)
        paintAll()
      }
      return h.slice(0, -1)
    })
  }

  function onPointerDown(e) {
    if (!ready || busy) return
    e.preventDefault()
    const pt = canvasPoint(e)
    if (!pt) return
    pushHistory()

    if (tool === 'pointer') {
      setStrokes(s => [...s, { type: 'pointer', at: pt, emoji: pointerEmoji, size: brush }])
      return
    }
    if (tool === 'arrow') {
      drawingRef.current = { type: 'arrow', from: pt, to: pt, color: penColor, size: Math.max(3, brush / 6) }
      paintAll()
      return
    }
    if (tool === 'pen') {
      drawingRef.current = { type: 'pen', points: [pt], color: penColor, size: Math.max(2, brush / 4) }
      paintAll()
      return
    }
    if (tool === 'blur' || tool === 'blurStrong' || tool === 'pixel') {
      stampBlur(pt, tool)
      drawingRef.current = { type: 'blurdrag', kind: tool, last: pt }
      paintAll()
      return
    }
    if (tool === 'eraser') {
      stampEraser(pt)
      // Also erase nearby vector strokes (simplify: only blur layer)
      drawingRef.current = { type: 'eraser', last: pt }
      paintAll()
    }
  }

  function onPointerMove(e) {
    if (!drawingRef.current) return
    e.preventDefault()
    const pt = canvasPoint(e)
    if (!pt) return
    const d = drawingRef.current

    if (d.type === 'pen') {
      d.points.push(pt)
      paintAll()
    } else if (d.type === 'arrow') {
      d.to = pt
      paintAll()
    } else if (d.type === 'blurdrag') {
      if (dist(d.last, pt) > brush * 0.28) {
        stampBlur(pt, d.kind)
        d.last = pt
        paintAll()
      }
    } else if (d.type === 'eraser') {
      if (dist(d.last, pt) > brush * 0.25) {
        stampEraser(pt)
        d.last = pt
        paintAll()
      }
    }
  }

  function onPointerUp() {
    const d = drawingRef.current
    if (!d) return
    if (d.type === 'pen' && d.points?.length > 1) {
      setStrokes(s => [...s, { type: 'pen', points: d.points, color: d.color, size: d.size }])
    } else if (d.type === 'arrow' && d.from && d.to && dist(d.from, d.to) > 8) {
      setStrokes(s => [...s, { type: 'arrow', from: d.from, to: d.to, color: d.color, size: d.size }])
    }
    drawingRef.current = null
    paintAll()
  }

  async function handleApply() {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      const w = W.current
      const h = H.current
      paintAll()

      if (mediaType === 'image') {
        // Bake annotations into image
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        out.getContext('2d').drawImage(displayRef.current, 0, 0)
        const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92))
        if (!blob) throw new Error('Could not export image')
        const file = new File([blob], `status-edit-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        onApply?.({ mode: 'baked', file, previewUrl })
      } else {
        // Transparent overlay only (marks + blur layer)
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        const ctx = out.getContext('2d')
        if (blurLayerRef.current) ctx.drawImage(blurLayerRef.current, 0, 0)
        // redraw vectors only (no base)
        for (const s of strokes) {
          if (s.type === 'pen' && s.points?.length > 1) {
            ctx.strokeStyle = s.color
            ctx.lineWidth = s.size
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.beginPath()
            ctx.moveTo(s.points[0].x, s.points[0].y)
            for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
            ctx.stroke()
          } else if (s.type === 'arrow' && s.from && s.to) {
            drawArrow(ctx, s.from, s.to, s.color, s.size)
          } else if (s.type === 'pointer' && s.at) {
            ctx.font = `${s.size * 1.6}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(s.emoji, s.at.x, s.at.y)
          }
        }
        // Check if empty
        const sample = ctx.getImageData(0, 0, Math.min(w, 40), Math.min(h, 40)).data
        let hasInk = false
        for (let i = 3; i < sample.length; i += 4) {
          if (sample[i] > 8) { hasInk = true; break }
        }
        // Full scan is expensive — also check stroke count
        if (!hasInk && strokes.length === 0) {
          // empty overlay — just close without overlay
          onApply?.({ mode: 'overlay', file: null, previewUrl: null, empty: true })
          return
        }
        const blob = await new Promise((res) => out.toBlob(res, 'image/png'))
        if (!blob) throw new Error('Could not export overlay')
        const file = new File([blob], `status-overlay-${Date.now()}.png`, { type: 'image/png' })
        const previewUrl = URL.createObjectURL(blob)
        onApply?.({ mode: 'overlay', file, previewUrl })
      }
    } catch (e) {
      setError(e?.message || 'Could not save edits')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10050,
        background: 'rgba(8,12,18,0.94)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button type="button" onClick={onClose} style={hdrBtn}>Cancel</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Edit media</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            Blur words · mark people · arrows {sizeLabel ? `· ${sizeLabel}` : ''}
          </div>
        </div>
        <button type="button" onClick={undo} disabled={!history.length} style={{ ...hdrBtn, opacity: history.length ? 1 : 0.4 }}>
          Undo
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!ready || busy}
          style={{
            ...hdrBtn,
            background: G, border: 'none', color: '#fff',
            opacity: !ready || busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Saving…' : 'Done'}
        </button>
      </div>

      {/* Canvas stage */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 10, touchAction: 'none',
        }}
      >
        {!ready && !error && (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13 }}>Loading media…</div>
        )}
        {error && (
          <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 13, textAlign: 'center', padding: 16 }}>{error}</div>
        )}
        <canvas
          ref={displayRef}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 12,
            cursor: tool === 'pointer' ? 'pointer' : 'crosshair',
            touchAction: 'none',
            display: ready ? 'block' : 'none',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            background: '#000',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {/* Toolbar */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(15,23,42,0.98)',
        padding: '10px 10px calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
          scrollbarWidth: 'none',
        }}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              style={{
                flexShrink: 0,
                border: `1.5px solid ${tool === t.id ? G : 'rgba(255,255,255,0.12)'}`,
                background: tool === t.id ? 'rgba(15,157,88,0.2)' : 'rgba(255,255,255,0.04)',
                color: tool === t.id ? '#86efac' : 'rgba(255,255,255,0.75)',
                borderRadius: 999,
                padding: '8px 12px',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Size</span>
          {BRUSH_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setBrush(s)}
              style={{
                width: 28 + (s - 18) * 0.25,
                height: 28 + (s - 18) * 0.25,
                borderRadius: '50%',
                border: `2px solid ${brush === s ? G : 'rgba(255,255,255,0.2)'}`,
                background: brush === s ? 'rgba(15,157,88,0.35)' : 'rgba(255,255,255,0.08)',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`Brush ${s}`}
            />
          ))}

          {(tool === 'pen' || tool === 'arrow') && (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>Color</span>
              {PEN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPenColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c,
                    border: penColor === c ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: penColor === c ? '0 0 0 2px ' + G : 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                  aria-label={c}
                />
              ))}
            </>
          )}
        </div>

        {tool === 'pointer' && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, scrollbarWidth: 'none' }}>
            {POINTERS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => setPointerEmoji(em)}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                  border: pointerEmoji === em ? `2px solid ${G}` : '1px solid rgba(255,255,255,0.12)',
                  background: pointerEmoji === em ? 'rgba(15,157,88,0.2)' : 'rgba(255,255,255,0.05)',
                  fontSize: 20, cursor: 'pointer',
                }}
              >
                {em}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 8 }}>
          {TOOLS.find(t => t.id === tool)?.hint}
          {mediaType === 'video' ? ' · Saved as overlay on your video' : ' · Saved into your photo'}
        </div>
      </div>
    </div>
  )
}

function drawArrow(ctx, from, to, color, lineW = 4) {
  const head = Math.max(10, lineW * 3)
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineW
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4))
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

const hdrBtn = {
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
