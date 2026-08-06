# Phase 3 — ImageGroupingService integration (applied)

Task source: `docs/claudehelp.md`. Two targeted fixes, no styling changes.

## Investigation findings

1. **Variable name — FIX B was a no-op.** There is no `groupedImages` anywhere in `Chat.jsx`. The `useMemo` at (old) line 1368 assigned `groupedMessages`, and the render loop at line 2442 iterates `groupedMessages` (all five references: declaration + `groupedMessages.map`, `groupedMessages[i-1]` ×2, `groupedMessages[i+1]`). Same variable, consistent. Nothing to rename.

2. **Realtime INSERT handler** (`setupRealtimeChannel`, ~line 638-646): yes, it appends via a functional update:
   ```js
   setMessages(prev => {
     const withoutTemp = prev.filter(m => { ... temp-matching ... })
     if (withoutTemp.find(m => m.id === msg.id)) return withoutTemp
     return [...withoutTemp, msg]
   })
   ```
   It also strips the optimistic `temp_` row before appending, and dedupes by id.

## FIX A — Wire appendMessage for realtime grouping

Changes in `src/pages/Chat.jsx`:

1. **New state** (line 180):
   ```js
   const [groupedMessages, setGroupedMessages] = useState([])
   ```
2. **Removed the `useMemo`** that derived `groupedMessages` from `messages`; also dropped `useMemo` from the React import (line 1) — it was the only usage in this file.
3. **Initial load** — in `loadMessages` success path (`setMessages(data)` at line 1183):
   ```js
   setMessages(data)
   setGroupedMessages(imageGroupingService.groupMessages(data))
   ```
4. **Realtime INSERT** (line 647) — now appends incrementally:
   ```js
   setGroupedMessages(prev => imageGroupingService.appendMessage(prev, msg))
   ```
5. **Realtime UPDATE** (lines 652-660) — rebuild from the full updated list (rare):
   ```js
   setMessages(prev => {
     const next = prev.map(m => (m.id === msg.id ? { ...m, ...msg, _status: undefined } : m))
     setGroupedMessages(imageGroupingService.groupMessages(next))
     return next
   })
   ```
6. **Realtime DELETE** (lines 661-669) — rebuild from the full remaining list (rare):
   ```js
   setMessages(prev => {
     const next = prev.filter(m => m.id !== old.id)
     setGroupedMessages(imageGroupingService.groupMessages(next))
     return next
   })
   ```

## Post-fix confirmations

- `appendMessage` is now called on **every** realtime INSERT (single place: `Chat.jsx:647`).
- `groupMessages` is called only on **initial load** (`loadMessages`) and on **UPDATE / DELETE** — never on a plain new message.
- **ESLint** `npx eslint src/pages/Chat.jsx`: **13 problems (9 errors, 4 warnings)** — identical to the pre-existing baseline (13/9/4). All are pre-existing (unused `CHAT_SOURCES`, `prefillMessage`, `isMsgHiddenForMe`, `e`; `no-useless-assignment`; `react-hooks/set-state-in-effect` ×4; `exhaustive-deps` ×3). No errors reference the grouping changes.
- **Build** `npm run build`: **passes** (`✓ built in 3.94s`).
- **grep** `groupedImages\|groupedMessages` in `src/pages/Chat.jsx`:
  ```
  180:   const [groupedMessages, setGroupedMessages] = useState([])
  2448:         {groupedMessages.map((msg, i) => {
  2450:           const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(groupedMessages[i - 1].created_at).toDateString()
  2451:           const nextSame = i < groupedMessages.length - 1 && groupedMessages[i + 1].from_user === msg.from_user
  2452:           const prevSame = i > 0 && groupedMessages[i - 1].from_user === msg.from_user && !showDate
  ```
  No `groupedImages` remains.

## Behavioural notes (kept within the requested design)

- **Optimistic sends**: a just-sent bubble appears once the realtime INSERT echo fires (the `temp_` row is removed and the real row appended to `groupedMessages`). It is no longer instant via the memo, but remains immediate on the realtime round-trip. No double-add: the optimistic `temp_` is never written to `groupedMessages`, and the echo is the single writer for sends.
- **Local mutations** that only update `messages` directly (`deleteMessageForMe`'s localStorage fallback, and the 15s expired-message purge interval) now reflect in `groupedMessages` only via a subsequent realtime event. The main delete/edit/disappear paths all write through to the DB, so their realtime UPDATE triggers the rebuild.
- **StrictMode**: the nested `setGroupedMessages` inside the UPDATE/DELETE updaters runs twice in dev, but `groupMessages` is pure/idempotent, so this is harmless.

`dist/index.html` and other build artifacts are touched by the build; commit only if intended.
