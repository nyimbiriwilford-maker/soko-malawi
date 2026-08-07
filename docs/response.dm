# Rebuild emoji picker from scratch (UI + styles)

Task source: `docs/claudehelp.md`.

## STEP 1 — Inventory

### Chat.jsx
- Emoji picker JSX block: was lines 3865–3935 (the `{showEmoji && (...)}` block containing `emoji-picker-panel` / `emoji-picker-head` / `emoji-recent-strip` / `emoji-grid` / `emoji-tabs`).
- Inline `<style>` rule removed: `Chat.jsx:2542` `.emoji-btn:hover{transform:scale(1.25);transition:transform 0.1s}` (old picker class, now dead).

### chat-thread.css
All picker CSS deleted: the base block (`/* Modern emoji picker */` + `.emoji-picker-panel/head/title{" svg"/cat-label/head-actions/close(+:hover/+:active)`, `.emoji-recent-strip`(+::webkit-scrollbar), `.emoji-recent-strip-empty`, `.emoji-grid`, `.emoji-btn`(+hover/+active), `.emoji-btn-freq`, `.emoji-recent-empty`, `.emoji-recent-empty-icon`, `.emoji-tabs`(+::webkit-scrollbar), `.emoji-tab`(+hover), `.emoji-tab.is-active`, `.emoji-tab-icon`, plus the `@media (max-width:420px)` grid override) **and** the mobile `@media` override block (`.emoji-picker-panel` / `.emoji-picker-head` / `.emoji-recent-strip` / `.emoji-picker-close` / `.emoji-grid` / `.emoji-btn` / `.emoji-btn-freq` / `.emoji-tabs` / `.emoji-tab`).

**Scope note:** `.chat-emoji-btn` selectors (`chat-thread.css:1249,1266,1268,1426,2017`) were **kept**. Those target the composer toolbar button (grouped with `.chat-attach-btn` / `.chat-offer-btn`) that opens the picker at `Chat.jsx:4047` — not the picker overlay itself. Removing them would break the shared attach/offer/emoji button styling and the open button render, which is outside "rebuild the picker."

### Kept (untouched, confirmed in Chat.jsx)
`showEmoji`/`setShowEmoji`, `emojiTab`/`setEmojiTab`, `recentEmojis`, `insertEmoji`, `emojiPickerRef`, `EMOJI_CATEGORIES`, `EMOJI_BY_ID`, `DEFAULT_EMOJI_TAB` — all still present and used. `SmilePlus` import kept (used by the composer emoji toggle button).

## STEP 2 — Deletions done
- Entire `{showEmoji && (...)}` picker JSX removed from Chat.jsx.
- Every picker CSS rule (base + mobile) removed from `chat-thread.css`. Remaining "emoji" matches in the CSS are only the `.chat-emoji-btn` toolbar trigger.

## STEP 3 — New picker
- **New CSS** appended to the end of `chat-thread.css`: `.ep-wrap` (fixed bottom sheet, 52vh / 520px, `z-index:1200`), `.ep-recent`, `.ep-recent-empty`, `.ep-grid`, `.ep-btn`, `.ep-tabs`, `.ep-tab`, `.ep-tab--active`, plus a `prefers-color-scheme: dark` block.
- **New JSX** placed in the same location (replaces the old picker): `ep-wrap` > `ep-recent` (recents or 🕘 empty) + `ep-grid` (category emojis) + `ep-tabs` (category nav with `ep-tab--active`).

## VERIFICATION
- `npx eslint src/pages/Chat.jsx` → 14 problems (10 errors, 4 warnings), **identical to the pre-existing baseline** (offer/call/DM/search setState + unused vars). No new errors; none touch the emoji code.
- `npm run build` → `✓ built in 2.73s` (2105 modules transformed). Passes.
- `grep ep-wrap|ep-grid|ep-tabs src/pages/Chat.jsx` → present at `Chat.jsx:3868, 3882, 3889`.