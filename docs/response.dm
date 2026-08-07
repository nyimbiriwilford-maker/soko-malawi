# Emoji picker: recent-emojis strip → Recent section in grid

Task source: `docs/claudehelp.md`. Implemented + verified.

## Change
Removed the standalone fixed "recent emojis" strip and rendering "Recent" as the **first section inside the scrollable emoji grid**.

### 1. Old recent strip removed
- **JSX**: `Chat.jsx` — removed the `<div className="ep-recent">` block (recent `ep-btn` tiles + the `ep-recent-empty` hint). It sat **between** `.ep-header` and `.ep-grid`, reserving a fixed `min-height: 48px` row. Replaced with nothing at that position.
- **CSS** (`chat-thread.css`): removed `.ep-recent`, `.ep-recent-empty`, and the dark-mode `.ep-recent` override. The picker's usable scroll area now starts directly below `.ep-header`.

### 2. New "Recent" section added (inside `.ep-grid`, before category tiles)
`Chat.jsx` — `.ep-grid` now renders, conditionally:

```jsx
{recentEmojis.length > 0 && (
  <>
    <div className="ep-section">Recent</div>
    {recentEmojis.map((em, i) => (
      <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
    ))}
  </>
)}
{(EMOJI_BY_ID[emojiTab]?.emojis || []).map((em, i) => (
  <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
))}
```

- Tiles reuse the exact same `.ep-btn` class / `insertEmoji(em)` as the category tiles (identical size, `repeat(8, 1fr)` grid cell).
- Header uses one new minimal `.ep-section` rule (`chat-thread.css`): `grid-column: 1 / -1` (spans all 8 columns), tightened uppercase label — styled in the picker's existing muted/tab language, not a one-off.
- **Empty case**: `recentEmojis.length > 0 &&` guard means no header/tiles render when there are no recents (no empty header).

> Note: the picker is **tab-based** — it renders only the active category's emojis (`EMOJI_BY_ID[emojiTab]`), and there was **no pre-existing per-category "section header + tile-grid" pattern** in the code to copy exactly. The grid is `repeat(8,1fr)` over `.ep-grid` (`Chat.jsx:3927` / `chat-thread.css`). The "Recent" tiles therefore reuse the identical tile pattern (`ep-btn` in the same grid), and `.ep-section` is the light header matching `.ep-tab` (inactive muted) / `.ep-header-label` styling. This satisfies "same tile size/grid" as the task requires; the only new CSS is the single spanning header rule.

### 3. insertEmoji tap behavior — unchanged
Recent and category tiles both call `insertEmoji(em)` (`Chat.jsx:~3928`), the same handler as before. No change to insertion logic, `RECENT_EMOJI_LIMIT` (30), `recentEmojis` state, or localStorage.

### 4. Fixed-height reservation removed
All of `.ep-recent` / `.ep-recent-empty` (the `min-height: 48px` strip + hint) CSS and JSX deleted, so the scroll area begins right below `.ep-header`.

### 5. Untouched
- Pick orphan/height fallback `--ep-locked-height` / `52vh`: untouched.
- `.ep-header`, keyboard-swap button, `.ep-close`: untouched.
- All prior mobile-lift fixes: untouched.
- `.ep-grid`, `.ep-tabs`, `.ep-btn` styles: untouched.

## Verification
- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)** — unchanged pre-existing baseline, **0 new**.
- `npm run build` → `✓ built in 3.10s`. Passes.
- No remaining references to `ep-recent` / `ep-recent-empty` anywhere; only the new `.ep-section`.