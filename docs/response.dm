# Fix: emoji picker on mobile — height + Recent tab relocation

Task source: `docs/claudehelp.md`.

## FIX 1 — Increase picker height on mobile
`src/styles/chat-thread.css` (mobile `@media` block, `.chat-thread .emoji-picker-panel`):
- `height: min(72dvh, 520px);` (was `min(50dvh, 380px)`)
- `max-height: min(72dvh, 520px);`

## FIX 2 — Remove Recent from category tabs, make top strip show recents

**Step A** — `src/constants/emojiCatalog.js`: deleted the `{ id: 'recent', ... }` entry from `EMOJI_CATEGORIES`; the array now starts with `smileys`. `DEFAULT_EMOJI_TAB = EMOJI_CATEGORIES[0]?.id` now resolves to `'smileys'` automatically (no change needed).

**Step B** — `src/pages/Chat.jsx`: replaced the `.emoji-frequent` quick-insert block with a `.emoji-recent-strip` that renders `recentEmojis` (localStorage-backed), or a `.emoji-recent-strip-empty` placeholder (🕘 "Your recent emojis will appear here") when none exist.

**Step C** — `src/pages/Chat.jsx`: removed the `emojiTab === 'recent'` branch from `.emoji-grid`; the grid now only renders `(EMOJI_BY_ID[emojiTab]?.emojis || [])`.

**Step D** — No change needed: header label already falls back to `'Smileys'` via `EMOJI_BY_ID[emojiTab]?.label || 'Smileys'`.

**Step E** — `src/styles/chat-thread.css`: renamed `.chat-thread .emoji-frequent` → `.chat-thread .emoji-recent-strip` (and its `::-webkit-scrollbar` rule), kept all properties; added the new `.chat-thread .emoji-recent-strip-empty` rule.

**Step F** — Removed the now-unused `EMOJI_FREQUENT` import from the `emojiCatalog` import list in Chat.jsx.

**Necessary follow-up (not in the task but required for correctness):** the `emojiTab` initial state in Chat.jsx used to default to `'recent'` (when recent history existed). With `recent` no longer a category, that would leave the grid empty and no active tab. Changed `Chat.jsx:247` to `useState(DEFAULT_EMOJI_TAB)`.

## VERIFICATION

### Lint
`npx eslint src/pages/Chat.jsx src/constants/emojiCatalog.js` → 10 errors / 4 warnings. **All pre-existing and unrelated** to the emoji work (e.g. `OFFER_EXPIRY_OPTIONS`/`offerExpiresAt`/`prefillMessage`/`isMsgHiddenForMe` unused vars, `react-hooks/set-state-in-effect` in DM/reaction/search effects). Confirmed identical by running eslint against the pre-change working tree (git stash round-trip). No emoji-picker errors.

### Build
`npm run build` → `✓ built in 3.75s` (2105 modules transformed). Success.

### Confirms
1. `recent` in emojiCatalog.js → only `RECENT_EMOJI_KEY` / `'soko_recent_emojis'` / "recently used" comment strings. **Not present in EMOJI_CATEGORIES.**
2. `emoji-frequent|EMOJI_FREQUENT` → zero matches in `src/pages/Chat.jsx` and `src/styles/chat-thread.css`. (The now-dead `export const EMOJI_FREQUENT` data still exists in emojiCatalog.js, intentionally left — unused, harmless.)
3. `emoji-recent-strip` → present in both files:
   - `Chat.jsx:3889` (`<div className="emoji-recent-strip">`), `3903` (`.emoji-recent-strip-empty`)
   - `chat-thread.css:1757, 1767, 1771`

## Result
- Mobile picker sheet is now up to `72dvh` / `520px` tall (was 50dvh/380px).
- Recent emojis live in a dedicated top strip (always visible above the grid), and the bottom tab band only shows real categories (Smileys first). The empty-state only appears in the strip when there's no recent history.