Done ✅

I moved the floating status-publishing indicator so it sits at the **top-right corner of the bottom nav**, and made it smaller.

## Change made
- File: `src/components/StatusPublishRing.jsx`
- Positioned the pill at the top-right of the bottom nav (was floating higher up):
  ```css
  right: 8px;
  bottom: calc(70px + env(safe-area-inset-bottom, 0px));
  ```
- Shrunk it: progress ring 34px → 24px, thinner strokes, smaller label (10px), smaller ✕ button, tighter padding.
- Updated the file's doc comment to match the new placement.

## Validation
- Build: `npm run build` not re-run (CSS/JSX-only change to an existing component, same API).
