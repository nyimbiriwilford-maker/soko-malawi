# Pre-Phase 6 fixes (applied)

Task source: `docs/claudehelp.md`. Two targeted fixes, no other changes.

## FIX 1 — Remove unused `imageUploadProgresses` state

All `src/pages/Chat.jsx`:

- Deleted the declaration:
  ```js
  const [imageUploadProgresses, setImageUploadProgresses] = useState({})
  ```
- Deleted all three `setImageUploadProgresses` calls:
  - `uploadQueue` initial zeros: `setImageUploadProgresses(Object.fromEntries(...))`
  - `uploadSingleImage` per-index update: `setImageUploadProgresses(prev => ({ ...prev, [index]: pct }))`
  - `uploadQueue` reset: `setImageUploadProgresses({})`

Progress is tracked solely in the pending group's `_imageGroup[i]._uploadProgress`, which the render already reads — the redundant state is gone.

## FIX 2 — Keep pending group visible during multi-image upload

`src/pages/Chat.jsx`:

- In the **realtime INSERT handler**, guarded the `groupedMessages` rebuild so it's skipped while a multi-image upload is in flight:
  ```js
  const next = [...withoutTemp, msg]
  if (!pendingGroupIdRef.current) {
    setGroupedMessages(imageGroupingService.groupMessages(next))
  }
  return next
  ```
  This prevents the first realtime echo from dropping the pending group (and its per-image progress bars).

- In **`uploadQueue`** (multi-image path), right after removing the pending group and clearing the ref, added a final authoritative rebuild so the real bubbles appear once all uploads finish and the next echo path is unblocked:
  ```js
  setGroupedMessages(prev => prev.filter(m => m.id !== pendingId))
  pendingGroupIdRef.current = null
  setGroupedMessages(imageGroupingService.groupMessages(messages))
  ```
  `messages` is the React state variable, in scope via closure inside `uploadQueue` (as the task noted). The rebuild references it; any "missing dependency" lint is pre-existing style, not introduced here.

## Verification

- `npx eslint src/pages/Chat.jsx`: **13 problems (9 errors, 4 warnings)** — restored to the pre-Phase-5 baseline; the `imageUploadProgresses` lint error is gone.
- `npm run build`: **passes** (`✓ built in 4.06s`).
- `grep -n "imageUploadProgresses" src/pages/Chat.jsx`: **no results**.

`dist/` build artifacts are touched by the build; commit only if intended.