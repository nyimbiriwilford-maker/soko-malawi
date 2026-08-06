Phase 5 — Improve upload behaviour for multi-image sends.

Objective: when the user sends multiple images, show ALL images immediately in their final grid layout with per-image progress, upload in parallel, and never show temporary single bubbles that later merge into a group.

═══════════════════════════════════
INVESTIGATION FIRST (no fixes yet)
═══════════════════════════════════

Show:
1. The full uploadQueue function currently in Chat.jsx
2. The full uploadAndSend function currently in Chat.jsx
3. How the preview modal send button calls uploadQueue — specifically what `items` array it passes
4. Confirm: does uploadToR2 in src/lib/r2.js currently accept an onProgress callback (it should after our earlier fix — confirm the signature)

Then apply the following.

═══════════════════════════════════
FIX — Phase 5 upload behaviour
═══════════════════════════════════

1. Add a per-image progress state near the other upload states:
   Find: const [uploadProgress, setUploadProgress] = useState(0)
   Replace with:
   const [uploadProgress, setUploadProgress] = useState(0)
   const [imageUploadProgresses, setImageUploadProgresses] = useState({})
   const pendingGroupIdRef = useRef(null)

2. Replace the full uploadQueue function with:

async function uploadQueue(items) {
  if (!items.length) return

  const isMultiImage = items.length > 1 && items.every(it => it.type === 'image')

  if (isMultiImage) {
    // Build an optimistic pending group with all images at their final positions
    const pendingId = `pending_group_${Date.now()}`
    pendingGroupIdRef.current = pendingId
    const pendingImgs = items.map((it, i) => ({
      id: `${pendingId}_${i}`,
      from_user: currentUser?.id,
      created_at: new Date().toISOString(),
      media_type: 'image',
      media_url: it.url,           // object URL for immediate preview
      _uploading: true,
      _uploadProgress: 0,
      _localIndex: i,
    }))
    const pendingGroup = {
      ...pendingImgs[0],
      id: pendingId,
      _isGroup: true,
      _isPending: true,
      _imageGroup: pendingImgs,
    }
    setGroupedMessages(prev => [...prev, pendingGroup])
    setImageUploadProgresses(Object.fromEntries(pendingImgs.map((_, i) => [i, 0])))
    setUploading(true)

    // Upload all in parallel
    const results = await Promise.allSettled(
      items.map((item, i) => uploadSingleImage(item, i, pendingId))
    )

    // Remove pending group regardless of outcome — realtime echoes will fill in successful ones
    setGroupedMessages(prev => prev.filter(m => m.id !== pendingId))
    pendingGroupIdRef.current = null
    setImageUploadProgresses({})
    setUploading(false)
    setPreview([])
    setUploadProgress(0)

    // For failed ones, show an alert
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) alert(`${failed} image${failed > 1 ? 's' : ''} failed to upload. Others were sent.`)

  } else {
    // Single file or non-image — use existing sequential path
    for (const item of items) {
      await uploadAndSend(item.file, item.type, item.caption)
    }
    setPreview([])
    setUploadProgress(0)
  }
}

3. Add uploadSingleImage helper directly above uploadQueue:

async function uploadSingleImage(item, index, pendingId) {
  const file = item.file
  const ext = file.name?.split('.').pop() || 'bin'
  const rawName = (file.name || 'image').replace(/\.[^/.]+$/, '')
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
  const path = `chat/${currentUser.id}/${safeName}_${Date.now()}_${index}.${ext}`

  const url = await uploadToR2(file, path, pct => {
    setImageUploadProgresses(prev => ({ ...prev, [index]: pct }))
    // Also update the pending group bubble's per-image progress
    setGroupedMessages(prev => prev.map(m => {
      if (m.id !== pendingId) return m
      const newGroup = m._imageGroup.map((img, i) =>
        i === index ? { ...img, _uploadProgress: pct } : img
      )
      return { ...m, _imageGroup: newGroup }
    }))
  })

  await sendMessage(item.caption || '', 'image', url)
  // Mark this image as done in the pending group
  setGroupedMessages(prev => prev.map(m => {
    if (m.id !== pendingId) return m
    const newGroup = m._imageGroup.map((img, i) =>
      i === index ? { ...img, _uploading: false, _uploadProgress: 100 } : img
    )
    return { ...m, _imageGroup: newGroup }
  }))
}

4. In renderMedia's _isGroup branch, update the thumb rendering to show per-image progress when _uploading is true. Find:

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

Replace with:

<div
  key={img.id}
  className={`chat-img-thumb${img._uploading ? ' is-uploading' : ''}`}
  onClick={e => {
    if (img._uploading) return
    e.stopPropagation()
    setLightbox({ url: img.media_url, type: 'image', caption: '' })
  }}
>
  <img src={img.media_url} alt="" loading="lazy" draggable={false} />
  {img._uploading && (
    <div className="chat-img-upload-progress">
      <div
        className="chat-img-upload-bar"
        style={{ width: `${img._uploadProgress || 0}%` }}
      />
      <span className="chat-img-upload-pct">
        {img._uploadProgress > 0 ? `${img._uploadProgress}%` : ''}
      </span>
    </div>
  )}
  {showOverflow && !img._uploading && (
    <div className="chat-img-overflow">+{overflow}</div>
  )}
</div>

5. In chat-thread.css, add after the .chat-img-overflow rule:

/* Per-image upload progress overlay */
.chat-thread .chat-img-thumb.is-uploading img {
  opacity: 0.5;
}
.chat-thread .chat-img-upload-progress {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 8px;
  pointer-events: none;
}
.chat-thread .chat-img-upload-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #fff;
  border-radius: 0 0 0 0;
  transition: width 0.2s ease;
  min-width: 0;
}
.chat-thread .chat-img-upload-pct {
  position: relative;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  margin-bottom: 6px;
}

Run npx eslint src/pages/Chat.jsx and npm run build. Report both. Then confirm:
- Sending 3 images shows them immediately in layout-3 grid with dimmed thumbnails and progress bars
- Each image's bar fills independently as it uploads
- Once all upload, the pending group disappears and is replaced by the real grouped messages from realtime echoes
- Sending a single image or voice note still works exactly as before (non-image path unchanged)