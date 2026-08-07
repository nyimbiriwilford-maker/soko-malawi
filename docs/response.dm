# Fix .attach-menu clipping (side-effect)

Task source: `docs/claudehelp.md`. Implemented + verified.

## Task 1 — Removed `overflow: hidden` from the bar

`.chat-thread .chat-input-bar` (`chat-thread.css:1199–1209`) now:
```css
.chat-thread .chat-input-bar {
  background: rgba(255,255,255,0.96) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--chat-line) !important;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
  gap: 6px !important;
  align-items: flex-end !important;
  width: 100% !important;
  box-sizing: border-box !important;
}
```
`overflow: hidden !important` removed. `width:100%` + `box-sizing:border-box` retained. This un-clips the `.attach-menu` pop-up.

## Task 2 — `.attach-menu` intact (verified)
`chat-thread.css:1323–1325` still has:
```css
.chat-thread .attach-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  ...
  z-index: 220;
```
`position:absolute`, `bottom:calc(100% + 10px)`, and `z-index:220` all intact. No changes needed.

## Task 3 — Send button still contained (verified)
- `.chat-input-bar`: `width:100% !important` + `box-sizing:border-box !important` ✓ (retained)
- `.chat-composer`: `flex:1` + `min-width:0` ✓ (`chat-thread.css:1211–1213`)

These two are sufficient to contain the row without `overflow:hidden`. The send button's right edge is bounded by the bar's border-box width; the composer shrinks (min-width:0) so nothing pushes it out.

## Deliverable answers
1. **`overflow: hidden` removed:** confirmed — absent from `.chat-input-bar` (`chat-thread.css:1199–1209`).
2. **`.attach-menu` absolute positioning intact:** confirmed (`chat-thread.css:1323–1325`, `z-index:220`).
3. **Build:** `npm run build` → `✓ built in 2.98s`. Passes (CSS-only change).