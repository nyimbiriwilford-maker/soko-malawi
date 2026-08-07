# Emoji picker: Recent as a first-class tab

Task source: `docs/claudehelp.md`. Implemented + verified.

## 1. `emojiCatalog.js` — `recent` added as FIRST category

Added as the first entry in `EMOJI_CATEGORIES` (`emojiCatalog.js:4–8`), same shape as the others:

```js
{
  id: 'recent',
  label: 'Recent',
  icon: '\u{1F551}',   // 🕑 clock
  emojis: [],
}
```
`emojis` is empty (static); real content is injected dynamically in `Chat.jsx`. Because `EMOJI_BY_ID` is derived via `Object.fromEntries(EMOJI_CATEGORIES...)`, `EMOJI_BY_ID['recent']` now exists with label `'Recent'`.

## 2. `DEFAULT_EMOJI_TAB` resolves to `'recent'` — no code change needed

`DEFAULT_EMOJI_TAB = EMOJI_CATEGORIES[0]?.id || 'smileys'` (`emojiCatalog.js:234`) is **derived**, not hardcoded. Since `EMOJI_CATEGORIES[0]` is now `recent`, it resolves to **`'recent'`**. Header label (`EMOJI_BY_ID[emojiTab]?.label`) now shows `"Recent"` on default open. No separate adjustment required.

## 3. `Chat.jsx` — tab-gated grid, unconditional block removed

- Imported `EMOJI_FREQUENT` (`Chat.jsx:61`).
- Removed the old unconditional `{recentEmojis.length > 0 && (<>... <div className="ep-section">Recent</div> ...)}` block entirely (`Chat.jsx:3919–3926` replaced).
- Tile source is now tab-gated (`Chat.jsx:3920–3923`):

```jsx
{(emojiTab === 'recent'
  ? (recentEmojis.length > 0 ? recentEmojis : EMOJI_FREQUENT)
  : (EMOJI_BY_ID[emojiTab]?.emojis || [])
).map((em, i) => (
  <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
))}
```
- On **any non-recent tab**, tile source is exactly `EMOJI_BY_ID[emojiTab]?.emojis || []` — recents no longer prepended. Tiles keep `.ep-btn` + `insertEmoji(em)`; insertion unchanged.

## 4. Recent renders as a normal tab

`.ep-tabs` iterates `EMOJI_CATEGORIES.map(cat => ...)` (`Chat.jsx:3930`), so `recent` gets the identical `<button className={...ep-tab--active}>` markup as Smileys/etc., first in order, showing the clock icon, with the same active-state styling. Behavior identical to other tabs.

## 5. Ordering: most-recently-used first

Confirmed preserved — `insertEmoji` (`Chat.jsx:1965`) prepends the tapped emoji and drops duplicates: `const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, RECENT_EMOJI_LIMIT)`. So the Recent tab grid shows newest-used first.

## 6. Empty-state / switchover

- Empty recents + picker opens (defaults to `recent` tab) → grid uses **`EMOJI_FREQUENT`** (curated 16-emoji list, `emojiCatalog.js`), not a blank grid.
- After the user taps an emoji, `insertEmoji` populates `recentEmojis` (state + localStorage). Next open (still default `recent`) → `recentEmojis.length > 0` → shows **real recents** instead of `EMOJI_FREQUENT`. Switchover is automatic via the existing ternary — no extra state added.

## 7. Untouched
`--ep-locked-height`, `.ep-header`, keyboard-swap button, mobile-lift fixes, and all other categories' static `emojis` arrays — unchanged.

## Verification results
- **`EMOJI_CATEGORIES[0]` is `'recent'`**; `DEFAULT_EMOJI_TAB` = `'recent'`. ✓
- **Old unconditional recent-section fully removed** (not bypassed): no `ep-section`, `ep-recent`, or stray Recent-header code remains in `src` (grep = none). The dead `.ep-section` CSS was also removed. ✓
- **Recents appear only on the `recent` tab**; other tabs show only their own `EMOJI_BY_ID[emojiTab].emojis`. ✓
- **Empty-state fallback to `EMOJI_FREQUENT` + automatic switch to real recents after first use** confirmed (ternary branch, no extra state). ✓
- `npx eslint src/pages/Chat.jsx src/constants/emojiCatalog.js` → **14 problems (10 errors, 4 warnings)** — unchanged baseline, **0 new**.
- `npm run build` → `✓ built in 3.35s`. Passes.