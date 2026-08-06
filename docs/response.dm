# Chat emoji picker — recently used emojis memory

Task source: `docs/claudehelp.md`. Scope: `src/constants/emojiCatalog.js` +
`src/pages/Chat.jsx` + `src/styles/chat-thread.css`. Existing emoji insertion,
cursor handling, mobile layout and desktop behavior are unchanged — persistence is
layered on top of the current architecture.

## Approach / root cause framing
The picker already renders categories from a static `EMOJI_CATEGORIES` catalog and a
Quick-insert row (`EMOJI_FREQUENT`). The cleanest fit was to insert a new `recent`
category at index 0 and, because the recent list must be reactive to user selections,
drive just that one grid from React state (loaded once from localStorage) instead of
the static catalog entry. This preserved the existing insertion flow exactly.

## Changes

### `src/constants/emojiCatalog.js`
- Added a `recent` category (label "Recent", 🕘 icon) at the **front** of
  `EMOJI_CATEGORIES` (placeholder empty `emojis`; `DEFAULT_EMOJI_TAB` now resolves to
  `recent` automatically, so the Recent tab shows first).
- Added `RECENT_EMOJI_KEY = 'soko_recent_emojis'` and `RECENT_EMOJI_LIMIT = 30`.
- Added `loadRecentEmojis()` — safely degrades to `[]` on corrupted/unavailable
  localStorage (validates the parsed array, filters non-string entries, caps it).
- Added `saveRecentEmojis(list)` — never throws, dedupes, caps at 30, newest first.

### `src/pages/Chat.jsx`
- Imported the new helpers.
- `recentEmojis` state initialized via `loadRecentEmojis`.
- `emojiTab` initialized to `recent` when there is history, otherwise falls back to the
  first real category (`smileys`) — satisfying the "no history → empty state + default
  category" rule.
- `insertEmoji()` (line ~1569) now also updates the recent list via a **functional**
  `setRecentEmojis` update: `[emoji, ...prev.filter(e => e !== emoji)].slice(0, LIMIT)`
  — moves to front, drops duplicates, caps at 30, and writes to localStorage only here
  (on selection, never on render). The caret-restore / typing path is untouched.
- Recent grid renders `recentEmojis` (with a clean empty state when empty); all other
  categories render exactly as before.

### `src/styles/chat-thread.css`
- Added `.emoji-recent-empty` / `.emoji-recent-empty-icon` for the no-history state
  (spans the full grid, subtle centered copy). The recent grid reuses the existing
  `.emoji-grid` so mobile sizing/scroll and the close button are unchanged.

## Behavior (target UX)
- Open picker → Recent tab appears first with commonly used emojis.
- Tap emoji → inserts at cursor, moves to front of recents (deduped), persisted.
- Continue typing immediately (existing commit-time caret restore).
- No history → clean empty state, defaults to Smileys.
- Persist across refresh, browser reopen, and returning to chat later.

## Performance
- localStorage written only inside `insertEmoji` (per selection), not per render.
- Read once at mount for state; lightweight, no render cost.
- Object identity of `recentEmojis` changes only on selection → no typing impact.

## Verification
- `npx eslint src/pages/Chat.jsx` → **12 problems (8 errors, 4 warnings)** — identical
  pre-existing baseline; none reference the edited lines.
- `npx eslint src/constants/emojiCatalog.js` → clean.
- `npm run build` → **passes** (`✓ built in 3.43s`).