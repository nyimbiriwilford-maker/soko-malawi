import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MENU_WIDTH = 240
const VIEWPORT_PADDING = 8
const ANCHOR_GAP = 8

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max))
}

function positionMenu(anchor, anchorPoint, height, viewportWidth, viewportHeight, width) {
  const point = anchorPoint || null
  let left
  let below

  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING)
    left = clamp(point.x, VIEWPORT_PADDING, maxLeft)
    below = point.y + ANCHOR_GAP
  } else if (anchor) {
    const rect = anchor.getBoundingClientRect()
    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING)
    left = clamp(rect.right - width, VIEWPORT_PADDING, maxLeft)
    below = rect.bottom + ANCHOR_GAP
  } else {
    return null
  }

  const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - height - VIEWPORT_PADDING)
  let top = below
  if (below + height + VIEWPORT_PADDING > viewportHeight) {
    const originY = point?.y ?? anchor.getBoundingClientRect().top
    top = originY - ANCHOR_GAP - height
    if (top < VIEWPORT_PADDING) top = clamp(top, VIEWPORT_PADDING, maxTop)
  }
  return { top, left }
}

export default function ChatPopupMenu({
  open,
  anchorEl,
  anchorPoint,
  groups = [],
  onClose,
  label = 'Menu',
  headerLabel,
  headerImage,
  title,
  subtitle,
  reactionRow = [],
  activeReactions,
  onReaction,
  width = MENU_WIDTH,
  iconSide = 'right',
}) {
  const menuId = useId()
  const instanceId = useId()
  const menuRef = useRef(null)
  const reactionRefs = useRef([])
  const itemRefs = useRef([])
  const anchorRef = useRef(anchorEl)
  const restoreFocusRef = useRef(null)
  const touchStartRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const items = groups.reduce((all, group) => all.concat(group), [])

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useLayoutEffect(() => {
    reactionRefs.current.length = reactionRow.length
    itemRefs.current.length = items.length
  }, [reactionRow.length, items.length])

  const close = useCallback(() => { onCloseRef.current?.() }, [])

  useEffect(() => {
    if (!open) return undefined
    anchorRef.current = anchorEl || null
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
    const frame = requestAnimationFrame(() => {
      const nodes = [...reactionRefs.current, ...itemRefs.current].filter(Boolean)
      nodes[0]?.focus()
    })
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
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
      const nodes = [...reactionRefs.current, ...itemRefs.current].filter(Boolean)
      if (!nodes.length) return
      event.preventDefault()
      const current = nodes.indexOf(document.activeElement)
      let next
      if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = nodes.length - 1
      else if (event.key === 'ArrowDown') next = (current + 1) % nodes.length
      else next = current <= 0 ? nodes.length - 1 : current - 1
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
    const rowHeight = 44
    const estimate = reactionRow.length * 44
      + (reactionRow.length ? 5 : 0)
      + items.length * rowHeight
      + Math.max(0, groups.length - 1) * 9
      + 12
    const measure = () => {
      const height = menuRef.current?.getBoundingClientRect().height || estimate
      const next = positionMenu(anchorRef.current, anchorPoint, height, window.innerWidth, window.innerHeight, width)
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
  }, [open, phone, groups.length, items.length, reactionRow.length, anchorPoint, width])

  if (!open) return null

  let itemIndex = 0

  function renderReactions() {
    if (!reactionRow.length) return null
    return (
      <div className="chat-popup-reactions">
        {reactionRow.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            ref={(node) => { reactionRefs.current[index] = node }}
            type="button"
            role="menuitem"
            className={`chat-popup-reaction${activeReactions?.[emoji] ? ' is-active' : ''}`}
            onClick={() => { close(); onReaction?.(emoji) }}
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    )
  }

  function renderGroups() {
    return groups.map((group, groupIndex) => (
      <div key={groupIndex}>
        {groupIndex > 0 ? (
          <div className="chat-popup-divider" role="separator"><span /></div>
        ) : null}
        {group.map((item) => {
          const index = itemIndex++
          const Icon = item.icon
          const icon = Icon ? (
            <span className={`chat-popup-icon${item.danger ? ' is-danger' : ''}`}>
              <Icon
                size={20}
                color={item.danger ? '#d93025' : '#5f6368'}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {item.badge === 'x' ? <span className="chat-popup-icon-badge" aria-hidden="true">×</span> : null}
            </span>
          ) : (
            <span className="chat-popup-icon" />
          )
          return (
            <button
              key={item.id || item.label}
              ref={(node) => { itemRefs.current[index] = node }}
              type="button"
              role="menuitem"
              className={`chat-popup-item${item.danger ? ' is-danger' : ''}`}
              disabled={!!item.disabled}
              onClick={() => { item.onSelect?.(); if (!item.keepOpen) close() }}
            >
              {iconSide === 'left' ? icon : null}
              <span className="chat-popup-label">{item.label}</span>
              {item.value != null || item.count > 0 ? (
                <span className="chat-popup-count">{item.value ?? item.count}</span>
              ) : null}
              {iconSide === 'right' ? icon : null}
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
          width: ${width}px;
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
          height: 44px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
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
        .chat-popup-icon { position: relative; flex: 0 0 20px; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; color: #5f6368; }
        .chat-popup-icon.is-danger { color: #d93025; }
        .chat-popup-icon-badge {
          position: absolute;
          right: -5px;
          bottom: -4px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #d93025;
          color: #fff;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          line-height: 12px;
          text-align: center;
        }
        .chat-popup-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-popup-count { flex: none; margin-left: auto; font-size: 12px; font-weight: 500; color: #5f6368; }
        .chat-popup-reactions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          padding: 2px 6px 6px;
          margin-bottom: 4px;
          border-bottom: 1px solid #e8eaed;
        }
        .chat-popup-reaction {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          font-family: inherit;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .chat-popup-reaction.is-active { opacity: 0.6; }
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
        .chat-popup-sheet-head { display: flex; align-items: center; gap: 12px; padding: 8px 20px 10px; }
        .chat-popup-sheet-image { width: 40px; height: 40px; flex: none; border-radius: 10px; object-fit: cover; border: 1px solid #e8eaed; background: #f1f3f4; }
        .chat-popup-sheet-head-text { min-width: 0; }
        .chat-popup-sheet-head .chat-popup-sheet-title,
        .chat-popup-sheet-head .chat-popup-sheet-subtitle { padding: 0; }
        .chat-popup-sheet-type { font-size: 12px; font-weight: 700; color: #80868b; letter-spacing: 0.02em; }
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
        .chat-popup-item.is-danger { color: #d93025; }
        .chat-popup-item.is-danger:active { background: #fdecea; }
        @media (hover: hover) {
          .chat-popup-item:hover:not(:disabled) { background: #f6fbf8; }
          .chat-popup-item.is-danger:hover:not(:disabled) { background: #fdecea; }
          .chat-popup-reaction:hover { background: #f6fbf8; }
        }
        @media (max-width: 768px), (hover: none) {
          .chat-popup-item { height: 52px; }
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
            {headerImage || headerLabel ? (
              <div className="chat-popup-sheet-head">
                {headerImage ? <img className="chat-popup-sheet-image" src={headerImage} alt="" /> : null}
                <div className="chat-popup-sheet-head-text">
                  {headerLabel ? <div className="chat-popup-sheet-type">{headerLabel}</div> : null}
                  {title ? <div className="chat-popup-sheet-title">{title}</div> : null}
                  {subtitle ? <div className="chat-popup-sheet-subtitle">{subtitle}</div> : null}
                </div>
              </div>
            ) : (
              <>
                {title ? <div className="chat-popup-sheet-title">{title}</div> : null}
                {subtitle ? <div className="chat-popup-sheet-subtitle">{subtitle}</div> : null}
              </>
            )}
            {renderReactions()}
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
            {renderReactions()}
            {renderGroups()}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
