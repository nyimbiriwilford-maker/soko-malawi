Phase: proper per-image deletion integration with image groups.

Four problems to fix, in order. No styling changes unless specified.

═══════════════════════════════════
PROBLEM SUMMARY (from investigation)
═══════════════════════════════════
1. Long-pressing a group bubble only targets group[0] — other images can't be individually deleted
2. No per-image long-press/hold affordance in thumbnails
3. Soft-delete (hide_message_for_me / soft_delete_message) shows a "deleted" placeholder bubble that visually splits the remaining group
4. groupedMessages is not rebuilt after local deleteMessageForMe mutation (only after realtime echo)

═══════════════════════════════════
FIX A — Per-image long-press in group thumbnails
═══════════════════════════════════

1. Add state near other action state (around where actionMsg/actionMode are declared):
   const [imageActionMsg, setImageActionMsg] = useState(null)

2. Add a long-press hook for thumbnails. Add this ref near other refs:
   const thumbPressTimer = useRef(null)

3. In renderMedia's _isGroup branch, replace the thumbnail wrapper:

Find:
<div
  key={img.id}
  className={`chat-img-thumb${img._uploading ? ' is-uploading' : ''}`}
  onClick={e => {
    if (img._uploading) return
    e.stopPropagation()
    setLightbox({ url: img.media_url, type: 'image', caption: '' })
  }}
>

Replace with:
<div
  key={img.id}
  className={`chat-img-thumb${img._uploading ? ' is-uploading' : ''}`}
  onClick={e => {
    if (img._uploading) return
    e.stopPropagation()
    setLightbox({ url: img.media_url, type: 'image', caption: '' })
  }}
  onPointerDown={e => {
    if (img._uploading) return
    e.stopPropagation()
    thumbPressTimer.current = setTimeout(() => {
      setImageActionMsg(img)
    }, 420)
  }}
  onPointerUp={e => { clearTimeout(thumbPressTimer.current) }}
  onPointerCancel={e => { clearTimeout(thumbPressTimer.current) }}
  onPointerMove={e => { clearTimeout(thumbPressTimer.current) }}
  onContextMenu={e => {
    if (img._uploading) return
    e.preventDefault()
    e.stopPropagation()
    setImageActionMsg(img)
  }}
>

═══════════════════════════════════
FIX B — Per-image action sheet
═══════════════════════════════════

Add a new per-image action sheet JSX. Find the existing delete action sheet block (the one that renders deleteMessageForMe / deleteMessageForEveryone buttons, around line 2909-2936) and add a SEPARATE sheet directly after it for individual image actions:

{imageActionMsg && (
  <div className="chat-action-overlay" onClick={() => setImageActionMsg(null)}>
    <div className="chat-action-sheet" onClick={e => e.stopPropagation()}>
      <div className="chat-action-title">Image</div>
      <button
        className="chat-action-btn"
        onClick={() => {
          setImageActionMsg(null)
          setLightbox({ url: imageActionMsg.media_url, type: 'image', caption: '' })
        }}
      >
        View
      </button>
      
        className="chat-action-btn"
        href={imageActionMsg.media_url}
        download
        target="_blank"
        rel="noreferrer"
        onClick={() => setImageActionMsg(null)}
      >
        Download
      </a>
      <button
        className="chat-action-btn chat-action-btn--danger"
        onClick={() => {
          const img = imageActionMsg
          setImageActionMsg(null)
          deleteMessageForMe(img)
        }}
      >
        Delete for me
      </button>
      {imageActionMsg.from_user === currentUser?.id && (
        <button
          className="chat-action-btn chat-action-btn--danger"
          onClick={() => {
            const img = imageActionMsg
            setImageActionMsg(null)
            deleteMessageForEveryone(img)
          }}
        >
          Delete for everyone
        </button>
      )}
      <button className="chat-action-btn chat-action-btn--cancel" onClick={() => setImageActionMsg(null)}>
        Cancel
      </button>
    </div>
  </div>
)}

═══════════════════════════════════
FIX C — Fix soft-delete visual splitting of image groups
═══════════════════════════════════

The core problem: soft_delete_message sets media_url=NULL on an image row. groupMessages then sees it as a non-image (isImageMessage requires media_url truthy) and renders it as a "deleted" placeholder bubble that splits the surrounding image group.

Fix: in both the UPDATE and DELETE realtime handlers, filter out soft-deleted image rows before passing to groupMessages. Soft-deleted image rows are: media_type==='image' && !media_url && deleted_at is set.

In the UPDATE handler, find:
setMessages(prev => {
  const next = prev.map(m => (m.id === msg.id ? { ...m, ...msg, _status: undefined } : m))
  setGroupedMessages(imageGroupingService.groupMessages(next))
  return next
})

Replace with:
setMessages(prev => {
  const next = prev.map(m => (m.id === msg.id ? { ...m, ...msg, _status: undefined } : m))
  const forGrouping = next.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
  setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
  return next
})

In the DELETE handler, find:
setMessages(prev => {
  const next = prev.filter(m => m.id !== old.id)
  setGroupedMessages(imageGroupingService.groupMessages(next))
  return next
})

Replace with:
setMessages(prev => {
  const next = prev.filter(m => m.id !== old.id)
  const forGrouping = next.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
  setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
  return next
})

Also apply the same filter in loadMessages where groupMessages is called on initial load:
Find:
setGroupedMessages(imageGroupingService.groupMessages(data))

Replace with:
const forGrouping = data.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
setGroupedMessages(imageGroupingService.groupMessages(forGrouping))

═══════════════════════════════════
FIX D — Optimistic groupedMessages rebuild after deleteMessageForMe
═══════════════════════════════════

deleteMessageForMe currently only updates messages state; groupedMessages rebuilds only after the realtime UPDATE echo (a round trip). For instant visual feedback, also rebuild groupedMessages immediately.

In deleteMessageForMe, after:
setMessages(prev => prev.filter(m => m.id !== id))

Add:
setGroupedMessages(prev => {
  const next = prev
    .map(m => {
      if (!m._isGroup) return m.id === id ? null : m
      const newGroup = m._imageGroup.filter(img => img.id !== id)
      if (!newGroup.length) return null
      if (newGroup.length === 1) return { ...newGroup[0], _isGroup: false, _imageGroup: undefined }
      return { ...m, _imageGroup: newGroup, id: newGroup[0].id }
    })
    .filter(Boolean)
  return next
})

In deleteMessageForEveryone, after the local soft-delete setMessages map, add:
setGroupedMessages(prev => {
  const next = prev
    .map(m => {
      if (!m._isGroup) return m
      const newGroup = m._imageGroup.filter(img => img.id !== id)
      if (!newGroup.length) return null
      if (newGroup.length === 1) return { ...newGroup[0], _isGroup: false, _imageGroup: undefined }
      return { ...m, _imageGroup: newGroup, id: newGroup[0].id }
    })
    .filter(Boolean)
  return next
})

═══════════════════════════════════
VERIFICATION
═══════════════════════════════════

Run npx eslint src/pages/Chat.jsx and npm run build.

Confirm:
1. imageActionMsg state is declared
2. thumbPressTimer ref is declared
3. grep -n "imageActionMsg" src/pages/Chat.jsx -- show all references
4. grep -n "forGrouping" src/pages/Chat.jsx -- confirm 3 occurrences (load, UPDATE, DELETE)
5. Lint no new errors, build passes