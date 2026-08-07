# Chat media placeholder: fix grouped images + remove debug logs

Task source: `docs/claudehelp.md`.

## Task 1 — Console output
Requires running the app in a browser (Supabase real-time INSERT) — not capturable from this shell. Expected pattern for the fix to be correct:
- `[media-debug]` (removed now, but it logged before change): `_pendingLoad: true` on new incoming media.
- `[renderMedia]` (removed now): previously showed `_pendingLoad: undefined` for **grouped** bubbles because `asGroup` spread only the anchor `group[0]` — the confirmed root cause fixed in Task 2.

## Task 2 — asGroup fix applied
`src/lib/imageGroupingService.js:130–134`:
```js
asGroup(group) {
  if (group.length === 1) return this.asBubble(group[0])
  const anyPending = group.some(m => m._pendingLoad)
  return { ...group[0], _imageGroup: group, _isGroup: true, _pendingLoad: anyPending }
}
```
Now if any member of the group is pending, the whole group bubble carries `_pendingLoad: true` → the placeholder shows for grouped incoming media.

## Task 3 — Tap clears all group members
`Chat.jsx` renderMedia `_pendingLoad` onClick now:
```js
const idsToClear = msg._isGroup
  ? new Set((msg._imageGroup || []).map(m => m.id))
  : new Set([msg.id])
```
- `setMessages` clears every member by id.
- `setGroupedMessages` clears matching top-level messages AND, for a group bubble, clears `_pendingLoad` on the bubble plus `_pendingLoad: false` on each matched member inside `_imageGroup`.

## Task 4 — Logs removed
- `[media-debug]` INSERT-handler log — removed.
- `[renderMedia]` top-of-function log — removed.
Verified via grep: zero occurrences left in `Chat.jsx`.

## Deliverable
1. Console output: requires live browser test (unavailable in this shell); root cause confirmed via code path.
2. `asGroup` fix: ✓ applied (`imageGroupingService.js`).
3. Grouped tap clears all members: ✓ applied (`Chat.jsx` onClick).
4. Both logs removed: ✓ confirmed.
5. Build: `npm run build` → `✓ built in 6.08s`. Passes.