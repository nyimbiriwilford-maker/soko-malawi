# Chat: paginated message loading (infinite scroll upward)

Task source: `docs/claudehelp.md`. Implemented + verified. Query uses actual schema fields `.or(...)/applyContextFilter`, not the generic `thread_id` from the brief.

## Task 1 — Current message loading (read-only findings)
- **Initial fetch:** `loadMessages(myId, source, ctxId)` at `Chat.jsx:1350`. Builds `supabase.from('messages').select('*')` with an `.or(...)` on `from_user`/`to_user`, applies `applyContextFilter` (source FK), plus a client-side source filter, hide-for-me + expiry filters.
- **State:** `messages` (`Chat.jsx:203`), `setMessages` at `:1396`, `groupedMessages`/`setGroupedMessages` (render source).
- **Scroll container ref:** `messagesListRef = useRef(null)` (`:414`), the `div.chat-messages` (`:3142`, `flex:1; overflowY:auto`), with an existing inline `onScroll` for near-bottom detection.
- **Original query:** sole traversal was `.order('created_at', {ascending:true})` with **no limit/range**.

## Task 2 — Pagination state
- `PAGE_SIZE = 20` (const), `hasMore`, `loadingMore`, `oldestLoadedIdRef` — added at `Chat.jsx:227–230`.
- `scrollContainerRef` aliased to the existing `messagesListRef` (`:415`), reused as the scroll container — no duplicate ref required.

## Task 3 — Initial fetch loads only the last 20
Both `loadMessages` query paths changed to `.order('created_at', {ascending:false}).limit(PAGE_SIZE)` (`:1352`, fallback `:1371`). After filtering, the result is `.reverse()` into `messagesForDisplay` (oldest→newest for display), `setMessages(messagesForDisplay)`, and when `messagesForDisplay.length < PAGE_SIZE` → `setHasMore(false)`; `oldestLoadedIdRef.current = messagesForDisplay[0].id` (`:1409-1415`).

## Task 4 — `loadMoreMessages` (`Chat.jsx:1420`)
```js
const loadMoreMessages = useCallback(async () => {
  if (loadingMore || !hasMore) return
  setLoadingMore(true)
  const oldest = messages.find(m => m.id === oldestLoadedIdRef.current)
  if (!oldest) { setLoadingMore(false); return }
  // fetch < oldest.created_at, order desc, limit PAGE_SIZE
  const older = (data||[]).filter(...same hide/expiry...).reverse()
  if (older.length < PAGE_SIZE) setHasMore(false)
  setMessages([...older, ...messages])
  setGroupedMessages(imageGroupingService.groupMessages([...older, ...messages]))
  startPosPreserve();  // Task 6
  setLoadingMore(false)
})
```

## Task 5 — scroll handler wired
Added `handleScroll` (`Chat.jsx:1476`) — `el.scrollTop <= 80 && hasMore && !loadingMore ⇒ loadMoreMessages()`. Wired into the container's existing `onScroll` (`:3147`) alongside the near-bottom logic (did not replace it).

## Task 6 — scroll position preserved
`loadMoreMessages` captures `prevScrollHeight` before prepend, then `requestAnimationFrame(() => el.scrollTop = el.scrollHeight - prevScrollHeight)` (`:1470`).

## Task 7 — loading indicator
JSX at top of messages list (`Chat.jsx:3183`, before empty-state):
- `{loadingMore && <div class="chat-load-more-spinner"><span>Loading...</span></div>}`
- `{!hasMore && messages.length > 0 && <div class="chat-load-more-end"><span>No more messages</span></div>}`
- CSS `.chat-load-more-spinner, .chat-load-more-end` added to `chat-thread.css`.

## Deliverable
- Initial fetch: `loadMessages` (`:1350`), now limited + reversed last-20.
- `PAGE_SIZE`/`hasMore`/`loadingMore`/`oldestLoadedIdRef` added ✓.
- Initial fetch loads last 20 only ✓.
- `loadMoreMessages` added ✓.
- Scroll handler wired to `div.chat-messages` ✓.
- Scroll position preserved on prepend ✓.
- Loading indicator + CSS added ✓.
- Grouping rebuilt from the merged raw list after prepend (older + messages) ✓.
- Do-not-touch respected: realtime INSERT append (bottom), `_pendingLoad` placeholder, emoji/input bar, grouping service all unchanged.
- Build: `npm run build` → `✓ built in 5.13s`. Passes.