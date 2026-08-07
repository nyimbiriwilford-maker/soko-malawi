# Fix: emoji grid too small on mobile (CSS only)

Task source: `docs/claudehelp.md`. All changes in `src/styles/chat-thread.css`, inside the mobile `@media` block. No JS/logic changes.

## Changes applied

1. **Picker height increased further** — `.chat-thread .emoji-picker-panel`:
   - `height: min(82dvh, 600px);` (was `min(72dvh, 520px)`)
   - `max-height: min(82dvh, 600px);`

2. **Header shrunk** — added mobile rule:
   ```css
   .chat-thread .emoji-picker-head { padding: 6px 10px; min-height: 0; }
   ```

3. **Recent strip shrunk** — added mobile rule:
   ```css
   .chat-thread .emoji-recent-strip { min-height: 36px; max-height: 48px; padding: 2px 6px; }
   ```

4. **Category tab row shrunk** — added mobile rules:
   ```css
   .chat-thread .emoji-tabs { min-height: 0; height: 38px; }
   .chat-thread .emoji-tab  { height: 38px; min-width: 32px; }
   ```

5. **Grid takes all remaining space** — confirmed the mobile `.chat-thread .emoji-grid` rule already has `flex: 1 1 0px; min-height: 0; max-height: none;` (unchanged — already correct).

6. **Smaller emoji buttons** — `.chat-thread .emoji-btn`:
   - `font-size: 22px` (was 24px)
   - `min-height: 38px` (was 44px)
   - `padding: 4px 2px` (was 6px 2px)

(`.emoji-btn-freq` untouched — recent-strip buttons stay at 22px / 42×42.)

## Result
- Picker sheet up to `82dvh` / `600px` tall.
- Header, recent strip, and tab row are more compact (`flex:none` fixed rows), so the grid (the only `flex:1; min-height:0; max-height:none` child) spans essentially all remaining panel height.
- Slightly smaller buttons → more emojis fit per row/visible without scrolling.

## Verification
`npm run build` → `✓ built in 3.95s` (2105 modules transformed). Passes.