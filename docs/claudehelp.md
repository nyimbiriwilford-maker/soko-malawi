Two tasks in one pass: fix optimistic sends, then implement Phase 4 image group layouts.

═══════════════════════════════════
OPTIMISTIC SEND FIX (before Phase 4)
═══════════════════════════════════

In sendMessage (Chat.jsx), find the block that builds the optimistic bubble and calls setMessages:

const optimistic = { ...msgData, id: tempId, created_at: new Date().toISOString(), _status: 'sending',
  _retry: { body: trimmed, type, mediaUrl, extraFields, replyTo: replySnapshot } }
setMessages(prev => { const without = opts.replaceTempId ? prev.filter(m => m.id !== opts.replaceTempId) : prev
  return [...without, optimistic] })

Add this line immediately after the setMessages call:
setGroupedMessages(prev => imageGroupingService.appendMessage(prev, optimistic))

Then in the realtime INSERT handler, find:
setGroupedMessages(prev => imageGroupingService.appendMessage(prev, msg))

Replace with:
setGroupedMessages(prev => {
  const withoutTemp = prev.filter(m => m.id !== tempId && m.id !== msg.id)
  return imageGroupingService.appendMessage(withoutTemp, { ...msg, _status: undefined })
})

Wait — tempId is not in scope in the realtime handler. Instead use this approach:
setMessages(prev => {
  const withoutTemp = prev.filter(m => {
    if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
    if (m.id === msg.id) return false
    return true
  })
  const next = [...withoutTemp, msg]
  setGroupedMessages(imageGroupingService.groupMessages(next))
  return next
})

Note: this rebuilds groupedMessages on INSERT now (like UPDATE/DELETE) — acceptable since the optimistic path already gave instant feedback. The rebuild is still O(n) on messages but only fires once per message, not continuously.

Run npm run build — confirm passes before continuing to Phase 4.

═══════════════════════════════════
PHASE 4 — IMAGE GROUP LAYOUTS
═══════════════════════════════════

In src/pages/Chat.jsx, find the renderMedia function's _isGroup branch (the block that renders .chat-img-group when msg._isGroup is true). Replace the entire _isGroup rendering block with:

if (msg._isGroup) {
  const imgs = msg._imageGroup
  const total = imgs.length
  const visible = imgs.slice(0, 9)
  const overflow = total - 9

  const getLayout = (n) => {
    if (n === 1) return 'layout-1'
    if (n === 2) return 'layout-2'
    if (n === 3) return 'layout-3'
    if (n === 4) return 'layout-4'
    return 'layout-grid'
  }

  return (
    <div className={`chat-img-group ${getLayout(visible.length)}`}>
      {visible.map((img, idx) => {
        const isLast = idx === visible.length - 1
        const showOverflow = isLast && overflow > 0
        return (
          <div
            key={img.id}
            className="chat-img-thumb"
            onClick={e => { e.stopPropagation(); setLightbox({ url: img.media_url, type: 'image', caption: '' }) }}
          >
            <img src={img.media_url} alt="" loading="lazy" draggable={false} />
            {showOverflow && (
              <div className="chat-img-overflow">+{overflow}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

Then in src/styles/chat-thread.css, add all layout CSS at the end of the file:

/* ── Image group layouts ── */
.chat-thread .chat-img-group {
  display: grid;
  gap: 3px;
  border-radius: 14px;
  overflow: hidden;
  max-width: 280px;
  cursor: pointer;
}

/* 1 image — full width */
.chat-thread .chat-img-group.layout-1 {
  grid-template-columns: 1fr;
}
.chat-thread .chat-img-group.layout-1 .chat-img-thumb img {
  max-height: 280px;
}

/* 2 images — equal columns */
.chat-thread .chat-img-group.layout-2 {
  grid-template-columns: 1fr 1fr;
}

/* 3 images — large left, two stacked right */
.chat-thread .chat-img-group.layout-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.chat-thread .chat-img-group.layout-3 .chat-img-thumb:first-child {
  grid-row: 1 / 3;
}

/* 4 images — 2x2 grid */
.chat-thread .chat-img-group.layout-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* 5-9 images — balanced responsive grid */
.chat-thread .chat-img-group.layout-grid {
  grid-template-columns: repeat(3, 1fr);
}

/* All thumbnails */
.chat-thread .chat-img-thumb {
  position: relative;
  overflow: hidden;
  background: #111;
  aspect-ratio: 1;
}
.chat-thread .chat-img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s;
}
.chat-thread .chat-img-thumb:hover img {
  opacity: 0.88;
}

/* Overflow badge (+X) */
.chat-thread .chat-img-overflow {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.5px;
}

/* Mobile */
@media (max-width: 899px) {
  .chat-thread .chat-img-group {
    max-width: min(72vw, 280px);
  }
}

Run npx eslint src/pages/Chat.jsx and npm run build. Report both results. Then confirm:
- A single image still renders as before (layout-1)
- A 2-image group gets side-by-side columns (layout-2)  
- A 3-image group gets large-left + two-stacked-right (layout-3)
- A 4-image group gets 2x2 (layout-4)
- 5+ images get a 3-column grid (layout-grid)
- 10+ images show only 9 thumbnails with +N on the last one