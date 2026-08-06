# Phase 5 — Multi-image upload behaviour (applied)

Task source: `docs/claudehelp.md`.

## Investigation findings

1. **`uploadQueue`** (`src/pages/Chat.jsx`):
   ```js
   async function uploadQueue(items) {
   for (const item of items) {
     await uploadAndSend(item.file, item.type, item.caption)
   }
   setPreview([])
   setUploadProgress(0)
   }
   ```
   Sequential — each file uploaded+sent one at a time; images appeared as they finished, then merged.

2. **`uploadAndSend`** (unchanged by this task): sets `uploading`, `setUploadProgress(0)`, builds R2 path `chat/{uid}/{safeName}_{Date.now()}.{ext}`, calls `uploadToR2(file, path, pct => setUploadProgress(pct))`, then `sendMessage(caption, type, url)`, `alert` on error, `setUploading(false)`.

3. **Preview send call** — the modal's send button calls `uploadQueue(preview)` (`onClick={() => uploadQueue(preview)}`, Enter key too). `items` is the `preview` state array; each item is `{ file, url, type, caption }` built in `pickFile` (`file`, a `URL.createObjectURL(file)` as `url`, resolved `type`, `caption`). So items have `.file`, `.type`, `.caption`, `.url` — matching what the new code reads.

4. **`uploadToR2`** (`src/lib/r2.js:105`) — signature **confirmed**: `export async function uploadToR2(file, path, onProgress = null)`. Fires `onProgress` (0-100) from `xhr.upload.onprogress`. It also compresses images to WebP and rewrites the path extension to `.webp`.

## Applied changes

### `src/pages/Chat.jsx`

1. **New state** (after `uploadProgress`):
   ```js
   const [imageUploadProgresses, setImageUploadProgresses] = useState({})
   const pendingGroupIdRef = useRef(null)
   ```

2. **`uploadQueue` replaced** exactly per spec:
   - Multi-image (len > 1, all `type === 'image'`): builds a single optimistic `pending_group_*` entry in `groupedMessages` with all thumbs at final positions (`_uploading: true`, `_uploadProgress: 0`, `media_url` = object URL), sets `uploading`, then uploads **all in parallel** via `Promise.allSettled(items.map((it,i) => uploadSingleImage(it,i,pendingId)))`.
   - On settle: removes the pending group, resets progress/`uploading`/`preview`, and `alert`s a count of failed uploads (others already sent).
   - Otherwise (single image, video, audio, file): unchanged sequential loop through `uploadAndSend`.

3. **`uploadSingleImage` added** directly above `uploadQueue`: builds a per-index R2 path, streams progress into `imageUploadProgresses[index]` *and* into the pending group's `_imageGroup[i]._uploadProgress` (live bar), then `sendMessage(item.caption || '', 'image', url)` and marks that thumb done (`_uploading:false, _uploadProgress:100`).

4. **`renderMedia` `_isGroup` thumbs**: `chat-img-thumb` now adds `is-uploading` when `img._uploading`; clicks are ignored while uploading; an overlay shows `.chat-img-upload-bar` (`width: _uploadProgress%`) + percentage text; the `+N` overflow badge is suppressed on uploading thumbs.

### `src/styles/chat-thread.css`

Added the per-image upload overlay block after `.chat-img-overflow`: `.is-uploading img { opacity: .5 }`, `.chat-img-upload-progress`, `.chat-img-upload-bar`, `.chat-img-upload-pct`.

## Verification

- `npm run build`: **passes** (`✓ built in 3.65s`).
- `npx eslint src/pages/Chat.jsx`: **14 problems (10 errors, 4 warnings)** — 13/9/4 pre-existing plus **one new error**:
  ```
  202:10 error 'imageUploadProgresses' is assigned a value but never used  no-unused-vars
  ```
  This state is write-only by design of the spec: progress is written into `imageUploadProgresses` but the render reads `img._uploadProgress` from the pending group instead. Harmless, but it's a new lint error. If you want it gone, either drop `imageUploadProgresses` (read progress only from the group) or use it as the pct source in the overlay.
- Confirmation vs the listed behaviours:
  - 3 images → `isMultiImage` true → one pending group → `layout-3` with dimmed thumbs + progress bars. ✓
  - Each thumb's bar fills independently (`index`-scoped progress). ✓
  - On completion the pending group is removed and the real grouped bubbles arrive via the realtime INSERT rebuild (each `sendMessage` optimistic also appends, so there's no gap). ✓
  - Single image / voice note / video / file → `isMultiImage` false → unchanged sequential path. ✓

## Caveats (behavioural notes, not code deviations)

- **Pending group vs realtime rebuild**: the realtime INSERT handler rebuilds `groupedMessages` from the `messages` state, which never contained the `pending_group_*` entry. So as soon as the *first* upload's echo arrives, the pending group is dropped and any still-uploading thumbs revert to their individual optimistic bubbles (they reappear in the trailing group as their `sendMessage` completes, since consecutive same-sender images re-join via `appendMessage`). Net effect is correct final grouping, but the per-image overlay for not-yet-uploaded images can blink off after the first echo. If you want the pending group to persist until ALL uploads finish, the INSERT rebuild would need to preserve/merge pending groups (e.g., skip rebuild while `pendingGroupIdRef.current` is set, then rebuild once after removal).
- `imageUploadProgresses` is currently write-only (see lint note above).

`dist/` build artifacts are touched by the build; commit only if intended.
