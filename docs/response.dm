# Phase 6 — Real-time update optimisation (applied)

Task source: `docs/claudehelp.md`. No styling changes.

## Current state (confirmed before fixing)

**Realtime INSERT handler** (`src/pages/Chat.jsx`, `setupRealtimeChannel`, ~636-662) — as it stood after Phase 5:
```js
setMessages(prev => {
  const withoutTemp = prev.filter(m => {
    if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
    if (m.id === msg.id) return false
    return true
  })
  const next = [...withoutTemp, msg]
  if (!pendingGroupIdRef.current) {
    setGroupedMessages(imageGroupingService.groupMessages(next))  // ← full O(n) rebuild per message
  }
  return next
})
```
UPDATE and DELETE handlers also did full `groupMessages` rebuilds (rare paths, correct).

**Scroll-to-bottom** (lines ~354-363): the smart auto-scroll effect already pins to bottom only when `nearBottomRef.current` is true OR the last message is the user's own (optimistic); otherwise it increments `unreadBelow`. It does **not** scroll unconditionally on every message — scroll position preservation is already satisfied, so **no scroll change was needed**. Reported as confirmed.

## Changes

### `src/pages/Chat.jsx`

1. **INSERT handler — incremental append.** Replaced the `groupMessages(next)` rebuild (inside the `if (!pendingGroupIdRef.current)` guard) with a cheap O(1) append that also strips the optimistic `temp_` bubble before appending the real message:
   ```js
   setGroupedMessages(prev => {
     const withoutOptimistic = prev.filter(m =>
       !(String(m.id).startsWith('temp_') &&
         m.from_user === msg.from_user &&
         m.media_type === msg.media_type)
     )
     return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
   })
   ```
   - Common case (new message, no multi-upload in flight): strip temp + append incrementally → O(1).
   - Multi-upload in flight (`pendingGroupIdRef.current` set): grouped update skipped entirely → pending group stays visible with progress bars.
   - UPDATE / DELETE: unchanged — still full `groupMessages` rebuild (rare, correct).

2. **`renderMedia` wrapped in `useCallback`** to stop it being recreated every render:
   ```js
   const renderMedia = useCallback(function renderMedia(msg, caption) {
     ...
   }, [lightbox, setLightbox, playingId, audioProgress, audioDuration, audioRefs, currentUser, setGroupedMessages, pendingGroupIdRef])
   ```
   Added `useCallback` to the React import.

## Verification

- `npx eslint src/pages/Chat.jsx`: **14 problems (9 errors, 5 warnings)**. Errors unchanged at **9** (no new errors). One **new warning**:
  ```
  1857:6 warning React Hook useCallback has a missing dependency: 'renderVoiceNote' ...  react-hooks/exhaustive-deps
  ```
  `renderMedia` calls `renderVoiceNote` (a sibling function) which the task-specified dep array omits. Keeping the exact requested deps array per spec; to silence it you'd either add `renderVoiceNote` to the deps (which defeats memoization since it's recreated each render) or wrap `renderVoiceNote` in its own `useCallback` too.
- `npm run build`: **passes** (`✓ built in 3.27s`).
- `grep -n "groupMessages\|appendMessage" src/pages/Chat.jsx`:
  ```
  649  // appendMessage handles grouping rules (same sender, within 60s, image type)
  656  return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
  671  setGroupedMessages(imageGroupingService.groupMessages(next))        // UPDATE
  680  setGroupedMessages(imageGroupingService.groupMessages(next))        // DELETE
  1198 setGroupedMessages(imageGroupingService.groupMessages(data))       // initial load
  1264 setGroupedMessages(prev => imageGroupingService.appendMessage(prev, optimistic))  // optimistic send
  1460 setGroupedMessages(imageGroupingService.groupMessages(messages))   // uploadQueue final rebuild
  ```
- Confirmed:
  - INSERT handler now uses **appendMessage** (line 656), not `groupMessages`. ✓
  - UPDATE (671) and DELETE (680) still use **groupMessages**. ✓
  - Build passes; lint has **no new errors** (9 errors unchanged; +1 warning from `renderVoiceNote`). ✓

`dist/` build artifacts are touched by the build; commit only if intended.