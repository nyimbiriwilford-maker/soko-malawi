# Chat: multi-file + download buttons + upload progress bar (applied)

## FIX 1 — Multi-file selection (images & documents only)

### `src/pages/Chat.jsx`
- **State**: `const [preview, setPreview] = useState([])` (was `null`).
- **`pickFile`** (line ~1386): now sets `input.multiple = true` when `type === 'image' || type === 'file'`; maps `Array.from(e.target.files)` into `items` (each `{ file, url, type: resolved, caption: '' }`) and calls `setPreview(items)`. Video/audio/camera stay single.
- **`uploadQueue(items)`** (added above `uploadAndSend`): loops `await uploadAndSend(item.file, item.type, item.caption)`, then `setPreview([])` + `setUploadProgress(0)`.
- **`uploadAndSend`**: removed trailing `setPreview(null)` so remaining queue items aren't wiped mid-loop.
- **Preview modal**:
  - Gate: `{preview.length > 0 && (`; overlay close → `setPreview([])`; cancel button → `setPreview([])`.
  - Header title uses `preview[0]?.type`.
  - Media display → `chat-preview-grid` with `preview.map((p, i) => ...)` rendering each item plus a `.chat-preview-remove` ✕ button (`ps.filter((_, j) => j !== i)`).
  - Caption input edits index 0: `setPreview(ps => ps.map((p, i) => i === 0 ? { ...p, caption: e.target.value } : p))`; Enter + Send button call `uploadQueue(preview)`.

### `src/styles/chat-thread.css`
- Added `.chat-preview-grid`, `.chat-preview-item`, `.chat-preview-item img/video`, `.chat-preview-remove` (flex wrap grid, 120px thumbs, scrollable, remove badge) at end of file.

## FIX 2 — Download button on audio bubbles + better filenames

### `src/pages/Chat.jsx`
- **`renderVoiceNote`**: added a third element inside `.voice-times` — an `<a>` with `href={url}`, `download`, `target="_blank"`, `rel="noreferrer"`, `className="voice-download"`, `onClick={e => e.stopPropagation()}`, download SVG icon.
- **Lightbox** toolbar link: `download={(lightbox.url || '').split('/').pop().split('?')[0] || 'media'}` so the downloaded file keeps the R2 filename (e.g. `photo_..._<ts>.jpg`) instead of the raw URL slug.

### `src/styles/chat-thread.css`
- Added `.chat-thread .voice-download` (inline-flex, opacity 0.5 → 1 on hover) after the `.voice-times` rules.

## FIX 3 — Real byte-progress upload bar

### `src/lib/r2.js`
- `uploadToR2(file, path, onProgress = null)`.
- Replaced the `fetch` PUT with an `XMLHttpRequest` PUT that wires `xhr.upload.onprogress` → `onProgress(Math.round((e.loaded / e.total) * 100))` (only when `e.lengthComputable`); `xhr.onload` resolves `getR2Url(path)` on 2xx, rejects on other status; `xhr.onerror` rejects. Headers unchanged (Content-Type, x-amz-date, Authorization, UNSIGNED-PAYLOAD).

### `src/pages/Chat.jsx`
- Added `const [uploadProgress, setUploadProgress] = useState(0)` next to `uploading`.
- `uploadAndSend`: `setUploadProgress(0)` on start; `uploadToR2(file, path, pct => setUploadProgress(pct))`.
- Ghost "Uploading…" bubble replaced with a progress-bar version: `Uploading… {uploadProgress}%` label + a 4px white bar whose `width` is `${uploadProgress || 0}%` (pulsing fill while at 0%).

## Verification
- `npx eslint src/pages/Chat.jsx src/lib/r2.js`: **13 problems (9 errors, 4 warnings)** — identical to the pre-existing baseline; no new issues introduced (all reported items are in unrelated pre-existing code, e.g. unused `CHAT_SOURCES`, set-state-in-effect).
- `npm run build`: **passes** (3.70s, 2103 modules transformed).