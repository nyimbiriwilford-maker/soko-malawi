# Per-image deletion integration with image groups — implementation

Task source: `docs/claudehelp.md` (Phase). All changes in `src/pages/Chat.jsx`.

## FIX A — Per-image long-press in group thumbnails
- Chat.jsx:231 — added state `const [imageActionMsg, setImageActionMsg] = useState(null)` next to `actionMsg`.
- Chat.jsx:299 — added ref `const thumbPressTimer = useRef(null)` next to `longPressRef`.
- Chat.jsx:1817-1856 (renderMedia `_isGroup` branch) — thumbnail wrapper now has `onPointerDown` (420 ms timer → `setImageActionMsg(img)`), `onPointerUp`/`onPointerCancel`/`onPointerMove` (clear timer), and `onContextMenu` (preventDefault + stopPropagation → `setImageActionMsg(img)`). `_uploading` thumbs skip all of these. Click-to-lightbox preserved.
  - Deviation from task spec: removed unused `e` params on `onPointerUp`/`onPointerCancel`/`onPointerMove` (`() => ...`). The spec's `e =>` variants tripped `no-unused-vars`; `e` was not referenced inside. Behavior identical.

## FIX B — Per-image action sheet
- Chat.jsx:3017-3066 — added separate sheet `{imageActionMsg && (...)}` directly after the message action-sheet block.
  - Buttons: View (opens lightbox), Download (`<a href download target=_blank>`), Delete for me → `deleteMessageForMe(img)`, Delete for everyone (only when `imageActionMsg.from_user === currentUser?.id`) → `deleteMessageForEveryone(img)`, Cancel.
  - Fixed the spec's malformed anchor (missing opening `<a` tag) — wrote a valid `<a>`.
  - Note: `chat-action-overlay` has no CSS rule (only the shared `chat-action-sheet` is styled in `src/styles/chat-thread.css:2088`). Task said "no styling changes unless specified", and this exact class was specified, so I left CSS untouched. `chat-action-sheet`/`chat-action-btn` visual treatment will render via the sheet's shared styles.

## FIX C — Stop soft-delete from visually splitting image groups
Soft-deleted image rows (`media_type==='image' && !media_url && deleted_at`) are filtered out of the array passed to `groupMessages`, in all 3 rebuild sites:
- Chat.jsx:686-687 — realtime UPDATE handler (`forGrouping` filter).
- Chat.jsx:696-697 — realtime DELETE handler.
- Chat.jsx:1239-1240 — `loadMessages` initial load.

## FIX D — Optimistic groupedMessages rebuild on delete
- Chat.jsx:774-789 (`deleteMessageForMe`) — after `setMessages` filter, rebuilds `groupedMessages`: removes `id` from any `_imageGroup`; drops empty groups; converts a 1-left group to a single bubble (`_isGroup:false`); rekeys group `id` to the new first image.
- Chat.jsx:822-838 (`deleteMessageForEveryone`) — same rebuild applied after the local soft-delete `setMessages` map (keeps non-group bubbles as-is, only filters `_imageGroup`).

## Verification
- `npx eslint src/pages/Chat.jsx` — **12 problems (8 errors, 4 warnings)** = the pre-existing baseline; **no new errors** introduced by this change (the 8 errors are pre-existing setState-in-effect / unused-var / useless-assignment in the file).
- `npm run build` — **passes** (`✓ built in 3.41s`).
- `grep -n "imageActionMsg"` — 10 references: state decl (:231), thumbnail long-press/context set (:1827), sheet render (:3017) + its handlers (:3025, :3032, :3043, :3050, :3054), Cancel (:3062), overlay close (:3018).
- `grep -n "forGrouping"` — **3 occurrences** as required: UPDATE (:686), DELETE (:696), loadMessages (:1239).
- `thumbPressTimer` — declared (:299), used in thumbnail handlers (:1827, :1831-1833).
