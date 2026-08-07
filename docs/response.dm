# Fix: emoji picker clipped on mobile — switch to position:fixed

Task source: `docs/claudehelp.md`. CSS-only change in `src/styles/chat-thread.css`.

## Change applied

Mobile `@media` block, `.chat-thread .emoji-picker-panel` — replaced entirely:

```css
.chat-thread .emoji-picker-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 100%;
  height: min(82dvh, 600px);
  max-height: min(82dvh, 600px);
  z-index: 1100;
  border-radius: 18px 18px 0 0;
  touch-action: pan-y;
}
```

- Removed the parent-relative `left:6px / right:6px / bottom:66px` positioning.
- Pins the picker to the bottom of the screen, full width, top-rounded bottom sheet, `z-index: 1100` (above the chat input bar).
- No longer clipped by the `overflow:hidden` thread parent.

## Desktop rule — unchanged

Confirmed the base rule (`.chat-thread .emoji-picker-panel`, chat-thread.css:1668–1685) still has `position: absolute; bottom: 70px; left: 8px; right: 8px; max-width: 420px; z-index: 200;`. Only the mobile override was touched.

## Verification
`npm run build` → `✓ built in 4.63s` (2105 modules transformed). Passes.