Apply all three fixes to src/pages/Chat.jsx and src/styles/chat-thread.css.

═══════════════════════════════════
FIX 1 — MULTI-FILE SELECTION (images and documents only; video/audio stay single)
═══════════════════════════════════

a) Change `preview` state from a single object to an array:
   Find: const [preview, setPreview] = useState(null)
   Replace: const [preview, setPreview] = useState([])

b) Replace the full pickFile function with:

function pickFile(accept, type, opts = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  if (opts.capture) input.setAttribute('capture', opts.capture)
  // Allow multiple only for image and generic file types
  if (type === 'image' || type === 'file') input.multiple = true
  input.onchange = e => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const items = files.map(file => {
      let resolved = type
      if (type === 'file' && file.type) {
        if (file.type.startsWith('image/')) resolved = 'image'
        else if (file.type.startsWith('video/')) resolved = 'video'
        else if (file.type.startsWith('audio/')) resolved = 'audio'
      }
      return { file, url: URL.createObjectURL(file), type: resolved, caption: '' }
    })
    setPreview(items)
  }
  input.click()
}

c) Fix every place that reads `preview` as a single object — update to treat it as array:

  Find: {preview && (
  Replace: {preview.length > 0 && (

  Find: onClick={() => !uploading && setPreview(null)}
  Replace: onClick={() => !uploading && setPreview([])}

  Find: setPreview(p => ({ ...p, caption: e.target.value }))
  Replace: setPreview(ps => ps.map((p, i) => i === 0 ? { ...p, caption: e.target.value } : p))

  Find: onClick={() => uploadAndSend(preview.file, preview.type, preview.caption)}
  Replace: onClick={() => uploadQueue(preview)}

  Find: setPreview(null)
  Replace: setPreview([])

  In the preview modal media display, replace the single-file render with a scrollable grid:
  Find this whole block:
  <div className="chat-preview-media">
    {preview.type === 'image' && <img src={preview.url} alt="" />}
    {preview.type === 'video' && <video src={preview.url} controls />}
    {preview.type === 'audio' && (<div>... <audio src={preview.url} controls .../></div>)}
    {preview.type === 'file' && (<div>... 📎 {preview.file?.name || 'File'}</div>)}
  </div>

  Replace with:
  <div className="chat-preview-media chat-preview-grid">
    {preview.map((p, i) => (
      <div key={i} className="chat-preview-item">
        {p.type === 'image' && <img src={p.url} alt="" />}
        {p.type === 'video' && <video src={p.url} controls />}
        {p.type === 'audio' && <audio src={p.url} controls style={{ width: '100%' }} />}
        {p.type === 'file' && <div style={{ padding: 12, textAlign: 'center' }}>📎 {p.file?.name || 'File'}</div>}
        <button className="chat-preview-remove" onClick={() => setPreview(ps => ps.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
      </div>
    ))}
  </div>

d) Add uploadQueue function directly above uploadAndSend:

async function uploadQueue(items) {
  for (const item of items) {
    await uploadAndSend(item.file, item.type, item.caption)
  }
}

e) Fix uploadAndSend — it currently calls setPreview(null) at the end, which would clear all remaining items. Remove setPreview([]) from inside uploadAndSend — let uploadQueue handle clearing after all done:

  Find in uploadAndSend:
  setUploading(false)
  setPreview(null)

  Replace with:
  setUploading(false)

  Then after uploadQueue's for loop, add:
  setPreview([])

═══════════════════════════════════
FIX 2 — DOWNLOAD BUTTON ON AUDIO BUBBLES + BETTER FILENAMES
═══════════════════════════════════

a) In renderVoiceNote, find the .voice-times div (the one containing the time span and the type label span). Add a download link as a third element inside it:

  Find:
  <div className="voice-times">

  Replace with:
  <div className="voice-times">

  Then find the closing </div> of voice-times and add before it:
  
    href={url}
    download
    target="_blank"
    rel="noreferrer"
    className="voice-download"
    onClick={e => e.stopPropagation()}
    aria-label="Download"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </a>

b) In the lightbox download link, improve the filename:
  Find:
  <a href={lightbox.url} target="_blank" rel="noreferrer" download title="Open original">

  Replace with:
  <a href={lightbox.url} target="_blank" rel="noreferrer" download={(lightbox.url || '').split('/').pop().split('?')[0] || 'media'} title="Download">

c) In chat-thread.css, add styling for the download button in voice bubbles. Find the .voice-times rules and add after them:

.chat-thread .voice-download {
  display: inline-flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.15s;
  color: inherit;
  text-decoration: none;
}
.chat-thread .voice-download:hover {
  opacity: 1;
}

═══════════════════════════════════
FIX 3 — UPLOAD PROGRESS BAR (real byte progress)
═══════════════════════════════════

a) Add uploadProgress state near the uploading state:
  Find: const [uploading, setUploading] = useState(false)
  Replace:
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

b) Modify uploadToR2 in src/lib/r2.js to accept and call a progress callback. Find:
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-amz-date': datetime,
      Authorization: authorization,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    },
    body: file,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return getR2Url(path);

  Replace with:
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('x-amz-date', datetime)
    xhr.setRequestHeader('Authorization', authorization)
    xhr.setRequestHeader('x-amz-content-sha256', 'UNSIGNED-PAYLOAD')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(getR2Url(path))
      else reject(new Error(`R2 upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('R2 upload failed: network error'))
    xhr.send(file)
  })

  Also update the function signature to accept onProgress:
  Find: export async function uploadToR2(file, path) {
  Replace: export async function uploadToR2(file, path, onProgress = null) {

c) In uploadAndSend in Chat.jsx, pass the progress callback:
  Find: const url = await uploadToR2(file, path)
  Replace: const url = await uploadToR2(file, path, pct => setUploadProgress(pct))

  Also reset progress on start and end:
  Find (start of uploadAndSend try block): setUploading(true)
  Replace:
  setUploading(true)
  setUploadProgress(0)

  Find (after uploadQueue for loop):
  setPreview([])
  Add after it: setUploadProgress(0)

d) Replace the existing "Uploading…" ghost bubble UI with a progress bar version:
  Find the whole uploading bubble block:
  {uploading && (
    <div className="msg-row is-mine is-group-end">
      <div className="msg-stack">
        <div className="msg-bubble is-mine" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: `pulse 1s ${d}s infinite` }} />
            ))}
            <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 4 }}>Uploading…</span>
          </div>
        </div>
      </div>
      <ChatAvatar url={myAvatar} initial={myInitial} size={28} isMine />
    </div>
  )}

  Replace with:
  {uploading && (
    <div className="msg-row is-mine is-group-end">
      <div className="msg-stack">
        <div className="msg-bubble is-mine" style={{ padding: '10px 14px', minWidth: 160 }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
            Uploading… {uploadProgress > 0 ? `${uploadProgress}%` : ''}
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 2,
              background: '#fff',
              width: `${uploadProgress || 0}%`,
              transition: 'width 0.2s ease',
              minWidth: uploadProgress > 0 ? 0 : '100%',
              animation: uploadProgress === 0 ? 'pulse 1s infinite' : 'none'
            }} />
          </div>
        </div>
      </div>
      <ChatAvatar url={myAvatar} initial={myInitial} size={28} isMine />
    </div>
  )}

═══════════════════════════════════
FINAL — Add CSS for multi-file preview grid to chat-thread.css:
═══════════════════════════════════

Add at the end of chat-thread.css:

.chat-thread .chat-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}
.chat-thread .chat-preview-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  max-width: 140px;
  flex: 1 1 120px;
}
.chat-thread .chat-preview-item img,
.chat-thread .chat-preview-item video {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.chat-thread .chat-preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: none;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

Run npx eslint src/pages/Chat.jsx src/lib/r2.js and npm run build. Report both results.