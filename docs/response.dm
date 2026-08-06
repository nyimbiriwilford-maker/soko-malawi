# Phase 7 — Edge case handling (applied)

Task source: `docs/claudehelp.md`. No styling changes.

## Investigation findings

**1. Pagination / infinite scroll — NONE.** `loadMessages` runs a single `supabase.from('messages').select('*').or(...).order('created_at', { ascending: true })` with no `.range()`/cursor and **replaces the whole `messages` array** via `setMessages(data)` (`Chat.jsx:1197`). No older-messages prepend path exists anywhere in Chat.jsx.

**2. Offline detection / sync — NONE.** No `navigator.onLine` check, no `online`/`offline` event listeners, and no offline-send queue in Chat.jsx. (`offlineApplyRef` at lines 289/1026+ is only the *other user's* presence grace timer; the only `navigator.*` uses are `vibrate`, `clipboard`, and `mediaDevices`.) Network-error handling exists as shared utils (`src/utils/networkError.js`, `src/hooks/useNetworkError.js`) but Chat.jsx doesn't wire them for message syncing.

**3. Delete flows** (`Chat.jsx:754-818`):
- `deleteMessageForMe` — `setMessages(prev => prev.filter(m => m.id !== id))` directly, then RPC `hide_message_for_me` (fallback: `hidden_for` update, then localStorage). No direct `groupedMessages` update.
- `deleteMessageForEveryone` — `setMessages` maps the row to a soft-deleted placeholder (deleted_at), RPC `soft_delete_message`; hard-delete fallback filters the array. No direct `groupedMessages` update.
- **Consistency note:** both flows mutate `messages` immediately but rely on the realtime **UPDATE** echo (which rebuilds `groupedMessages` via `groupMessages`) to reflect in the grouped view. RPCs do UPDATE/DELETE on the `messages` table, so the realtime rebuild self-heals — with a short gap. The localStorage-only fallback of `deleteMessageForMe` is the one path with no DB change → no realtime rebuild → bubble lingers in `groupedMessages` until the next event.

**4. Failed upload retry:**
- Failed bubble render: `isFailed = msg._status === 'failed'` (`Chat.jsx:2580`); row/bubble get `.is-failed`/`.is-failed-bubble`; `MsgMeta` shows **"Failed · tap to retry"** (`Chat.jsx:154`); bubble `onClick` → `if (isFailed) retryMessage(msg)` (`Chat.jsx:2691`); action sheet also has a **"Retry send"** button (`Chat.jsx:2898`).
- `retryMessage(msg)` (`Chat.jsx:1385`) reads `msg._retry = { body, type, mediaUrl, extraFields, replyTo }` and calls `sendMessage(body, type, mediaUrl, null, { replaceTempId: msg.id })`.
- **For images:** `_retry.mediaUrl` is the **already-uploaded R2 URL** (uploads happen before `sendMessage`), so retry re-sends that persisted URL — **no stale object-URL problem and no file re-upload needed**. This works for image types. If the *upload itself* fails (multi-image `uploadSingleImage` throws, or single `uploadAndSend` catch), no optimistic bubble is ever created, so there's nothing to retry — the multi-image path shows an alert and sends the others; there is **no retry for upload failures** (documented, not fixed this phase).

## Fixes applied vs confirmed

- **FIX A — pagination prepend (applied as TODO).** No pagination exists. Added the requested comment at the `loadMessages` grouped rebuild:
  ```js
  // TODO Phase 7: rebuild groupedMessages when older messages are prepended
  // (no pagination yet — loadMessages replaces the whole array; if older messages
  // are later prepended, use: setGroupedMessages(imageGroupingService.groupMessages([...olderMessages, ...currentMessages])))
  ```
- **FIX B — duplicate realtime events (applied).** Confirmed `appendMessage` has no dedupe (it appends to the end; a duplicate id would create a second bubble — the dedupe lives only in the `messages` filter). Added a duplicate guard to the INSERT `groupedMessages` updater that scans single bubbles **and** members of `_isGroup` groups:
  ```js
  setGroupedMessages(prev => {
    const alreadyExists = prev.some(m => {
      if (m._isGroup) return m._imageGroup?.some(img => img.id === msg.id)
      return m.id === msg.id
    })
    if (alreadyExists) return prev
    const withoutOptimistic = prev.filter(m =>
      !(String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type)
    )
    return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
  })
  ```
- **FIX C — failed retry (confirmed, documented).** Retry exists for both bubble-tap and action sheet; image retry works via preserved R2 `media_url` in `_retry`. Documented that upload-stage failures are not retryable as bubbles.
- **FIX D — delete + group collapse (confirmed).** The realtime DELETE handler (`Chat.jsx:~664-672`) rebuilds with `imageGroupingService.groupMessages(next)` on the remaining messages → a deleted group member is removed and the group reflows. `asGroup` in `imageGroupingService.js:113-116` returns `asBubble(group[0])` when `group.length === 1`, so a 1-remaining group correctly collapses to a single image bubble.
- **FIX E — app restart / session restore (confirmed).** `loadMessages` runs on mount and calls `setGroupedMessages(imageGroupingService.groupMessages(data))` (`Chat.jsx:1198`) — grouping is reconstructed from scratch on every load. No fix needed.

## Verification

- `npx eslint src/pages/Chat.jsx src/lib/imageGroupingService.js`: **13 problems (9 errors, 4 warnings)** — unchanged baseline; `imageGroupingService.js` itself is lint-clean.
- `npm run build`: **passes** (`✓ built in 3.66s`).

## Edge cases not solvable without schema/new infra

- **Offline message queue** (send-then-sync while offline) — requires persistent local queue + retry/merge logic and connection-state plumbing; not present today. Failed sends instead surface as tap-to-retry bubbles.
- **Retry of upload-stage failures** (the file never made it to R2) — would require persisting the original `File`/object URL across the pending-group lifecycle; object URLs are revoked when preview closes, so a durable queue would be needed to retry the upload itself.
- **localStorage-only hide fallback** has no DB trigger, so `groupedMessages` can't self-heal for that rare path without a periodic resync.