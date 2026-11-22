import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MENU_WIDTH = 224
const VIEWPORT_PADDING = 8
const ANCHOR_GAP = 8

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max))
}

function positionMenu(anchor, height, viewportWidth, viewportHeight) {
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING)
  const left = clamp(rect.right - MENU_WIDTH, VIEWPORT_PADDING, maxLeft)
  const below = rect.bottom + ANCHOR_GAP
  const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - height - VIEWPORT_PADDING)
  let top = below
  if (below + height + VIEWPORT_PADDING > viewportHeight) {
    top = rect.top - ANCHOR_GAP - height
    if (top < VIEWPORT_PADDING) top = clamp(top, VIEWPORT_PADDING, maxTop)
  }
  return { top, left }
}

export default function ChatPopupMenu({ open, anchorEl, groups = [], onClose, label = 'Menu', title, subtitle }) {
  const menuId = useId()
  const instanceId = useId()
  const menuRef = useRef(null)
  const itemRefs = useRef([])
  const anchorRef = useRef(anchorEl)
  const restoreFocusRef = useRef(null)
  const touchStartRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const items = groups.reduce((all, group) => all.concat(group), [])

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useLayoutEffect(() => { itemRefs.current.length = items.length }, [items.length])

  const close = useCallback(() => { onCloseRef.current?.() }, [])

  useEffect(() => {
    if (!open) return undefined
    anchorRef.current = anchorEl
    const onOtherOpen = (event) => {
      if (event.detail?.id !== instanceId) onCloseRef.current?.()
    }
    window.addEventListener('soko:chat-popup-open', onOtherOpen)
    window.dispatchEvent(new CustomEvent('soko:chat-popup-open', { detail: { id: instanceId } }))
    return () => window.removeEventListener('soko:chat-popup-open', onOtherOpen)
  }, [open, anchorEl, instanceId])

  useEffect(() => {
    if (!open) return undefined
    restoreFocusRef.current = document.activeElement
    const frame = requestAnimationFrame(() => { itemRefs.current[0]?.focus() })
    return () => {
      cancelAnimationFrame(frame)
      const target = anchorRef.current?.isConnected ? anchorRef.current : restoreFocusRef.current
      if (target?.isConnected && typeof target.focus === 'function') target.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const query = window.matchMedia('(max-width: 768px)')
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    return () => {
      query.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open || !phone) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open, phone])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (menuRef.current?.contains(event.target)) return
      const anchor = anchorRef.current
      if (anchor?.tagName === 'BUTTON' && anchor.contains(event.target)) return
      close()
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const nodes = itemRefs.current.filter(Boolean)
      if (!nodes.length) return
      event.preventDefault()
      const current = nodes.indexOf(document.activeElement)
      const next = event.key === 'ArrowDown'
        ? (current + 1) % nodes.length
        : (current <= 0 ? nodes.length - 1 : current - 1)
      nodes[next]?.focus()
    }
    function onScroll(event) {
      if (menuRef.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  useLayoutEffect(() => {
    if (!open || phone || !menuRef.current) return undefined
    const estimate = items.length * 48 + Math.max(0, groups.length - 1) * 9 + 12
    const measure = () => {
      const height = menuRef.current?.getBoundingClientRect().height || estimate
      const next = positionMenu(anchorRef.current, height, window.innerWidth, window.innerHeight)
      if (!next) return
      setPosition(prev => (
        Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5
          ? prev
          : next
      ))
    }
    measure()
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [open, phone, groups.length, items.length])

  if (!open) return null

  let itemIndex = 0

  function renderGroups() {
    return groups.map((group, groupIndex) => (
      <div key={groupIndex}>
        {groupIndex > 0 ? (
          <div className="chat-popup-divider" role="separator"><span /></div>
        ) : null}
        {group.map((item) => {
          const index = itemIndex++
          const Icon = item.icon
          return (
            <button
              key={item.id || item.label}
              ref={(node) => { itemRefs.current[index] = node }}
              type="button"
              role="menuitem"
              className="chat-popup-item"
              disabled={!!item.disabled}
              onClick={() => { close(); item.onSelect?.() }}
            >
              {Icon ? (
                <span className="chat-popup-icon">
                  <Icon size={20} color="#5f6368" strokeWidth={1.75} aria-hidden="true" />
                </span>
              ) : (
                <span className="chat-popup-icon" />
              )}
              <span className="chat-popup-label">{item.label}</span>
              {item.count > 0 ? <span className="chat-popup-count">{item.count}</span> : null}
            </button>
          )
        })}
      </div>
    ))
  }

  function onTouchStart(event) {
    touchStartRef.current = event.touches?.[0]?.clientY ?? null
  }

  function onTouchMove(event) {
    const start = touchStartRef.current
    const current = event.touches?.[0]?.clientY
    if (start == null || current == null) return
    if (current - start > 60) {
      touchStartRef.current = null
      close()
    }
  }

  return createPortal(
    <>
      <style>{`
        .chat-popup-layer {
          position: fixed;
          inset: 0;
          z-index: 1500;
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
        }
        .chat-popup-backdrop { position: absolute; inset: 0; background: transparent; pointer-events: none; }
        .chat-popup-layer[data-phone='true'] .chat-popup-backdrop {
          background: rgba(0,0,0,0.4);
          pointer-events: auto;
          animation: chatPopupFade 150ms ease both;
        }
        .chat-popup-card {
          position: absolute;
          width: ${MENU_WIDTH}px;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e8eaed;
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(16,24,40,0.12);
          padding: 6px;
          animation: chatPopupFade 120ms ease both;
        }
        .chat-popup-item {
          width: 100%;
          height: 48px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          box-sizing: border-box;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #202124;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .chat-popup-item:disabled { cursor: default; opacity: 0.6; }
        .chat-popup-icon { flex: 0 0 20px; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; color: #5f6368; }
        .chat-popup-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-popup-count { flex: none; margin-left: auto; font-size: 12px; font-weight: 500; color: #5f6368; }
        .chat-popup-divider { padding: 4px 0; }
        .chat-popup-divider > span { display: block; height: 1px; background: #e8eaed; }
        .chat-popup-sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
          background: #fff;
          border-radius: 16px 16px 0 0;
          max-height: 70vh;
          overflow-y: auto;
          box-sizing: border-box;
          padding: 8px 0 calc(env(safe-area-inset-bottom, 0px) + 8px);
          animation: chatPopupSlide 200ms ease both;
        }
        .chat-popup-handle { width: 36px; height: 4px; border-radius: 4px; background: #dadce0; margin: 0 auto 8px; }
        .chat-popup-sheet-title { padding: 8px 20px 2px; font-size: 15px; font-weight: 700; color: #202124; }
        .chat-popup-sheet-subtitle { padding: 0 20px 8px; font-size: 12px; color: #5f6368; }
        .chat-popup-cancel {
          width: 100%;
          height: 56px;
          margin-top: 4px;
          border: 0;
          border-top: 1px solid #e8eaed;
          background: #fff;
          color: #5f6368;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }
        .chat-popup-item:active { background: #e6f6ed; }
        @media (hover: hover) {
          .chat-popup-item:hover:not(:disabled) { background: #f6fbf8; }
        }
        @media (max-width: 768px), (hover: none) {
          .chat-popup-item { height: 56px; }
        }
        @keyframes chatPopupFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chatPopupSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .chat-popup-card, .chat-popup-sheet, .chat-popup-layer[data-phone='true'] .chat-popup-backdrop { animation: none !important; }
        }
      `}</style>
      <div className="chat-popup-layer" data-phone={phone ? 'true' : 'false'}>
        <div className="chat-popup-backdrop" onClick={close} />
        {phone ? (
          <div
            ref={menuRef}
            id={menuId}
            className="chat-popup-sheet"
            role="menu"
            aria-label={label}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            <div className="chat-popup-handle" />
            {title ? <div className="chat-popup-sheet-title">{title}</div> : null}
            {subtitle ? <div className="chat-popup-sheet-subtitle">{subtitle}</div> : null}
            {renderGroups()}
            <button type="button" className="chat-popup-cancel" onClick={close}>Cancel</button>
          </div>
        ) : (
          <div
            ref={menuRef}
            id={menuId}
            className="chat-popup-card"
            role="menu"
            aria-label={label}
            style={{ top: position.top, left: position.left }}
          >
            {renderGroups()}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
