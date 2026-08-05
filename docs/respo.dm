# Chat.jsx restoration — 4 items removed in c08d19f re-added (applied)

Source of truth: `git show 3552efa:src/pages/Chat.jsx` and `HEAD~1` (identical for these blocks). No other part of the file was touched; today's session changes (voice note fix, R2 migration, audio labels, video lightbox, MP3 icon) are unchanged.

## Changes in `src/pages/Chat.jsx`

1. **visualViewport height-tracking effect** (Chat.jsx:310–331)
   Re-added the `useEffect` that sets `--chat-vvh` (visible viewport height) and `--chat-vv-top` (keyboard offset) via `window.visualViewport` resize/scroll listeners, placed as the first effect under `// ── Effects ──`, restored verbatim.

2. **3 media query blocks** (Chat.jsx:1913–1929, inside the inline `<style>`)
   - `@media (max-width: 899px)` — sets `height/max-height: var(--chat-vvh, 100%)` on `.chat-page.chat-thread`, tightens `.chat-top-actions` gap, sizes buttons 34px, hides `.chat-search-toggle` on phones.
   - `@media (min-width: 900px)` — hides `.chat-menu-search` on desktop.
   - `@media (max-width: 360px)` — shrinks non-options buttons to 32px.

3. **`.chat-search-toggle` button + wrapper** (Chat.jsx:1991–1997)
   Restored `<div className="chat-top-actions" style={S.topActions}>` wrapper and the search button's `chat-search-toggle` class; re-added `S.topActions` to the `S` style object (Chat.jsx:3120).

4. **Responsive maxWidth on top status labels** (Chat.jsx:1962, 1968)
   `maxWidth: 160/140` → `maxWidth: 'min(160px, 38vw)'` (recording) and `'min(140px, 34vw)'` (typing). Left today's "is recording audio…" text as-is.

## Verification

- `npx eslint src/pages/Chat.jsx`: **13 problems (9 errors, 4 warnings)** — identical to the HEAD baseline (13/9/4); no new errors introduced.
- `npm run build`: **passes** (built in 4.69s).
- `grep -n "chat-vvh" src/pages/Chat.jsx`: present — lines 317 (setProperty), 330 (removeProperty), 1916–1917 (media query). All 3 media query blocks confirmed present via `chat-search-toggle` / `chat-top-actions` matches at lines 1913–1929.
