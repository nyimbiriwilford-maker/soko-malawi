# Optimistic send fix + Phase 4 image group layouts (applied)

Task source: `docs/claudehelp.md`.

## Part 1 — Optimistic send fix

Two edits in `src/pages/Chat.jsx`:

1. **`sendMessage` optimistic bubble** (`Chat.jsx:1246-1250`). Immediately after the optimistic `setMessages`, added:
   ```js
   setGroupedMessages(prev => imageGroupingService.appendMessage(prev, optimistic))
   ```
   So a just-sent bubble now appears in the grouped list instantly (as before), not after the realtime round-trip.

2. **Realtime INSERT handler** (`Chat.jsx:638-647`). Replaced the previous `setMessages` + `setGroupedMessages(prev => appendMessage(prev, msg))` with the combined rebuild approach (as specified — `tempId` isn't in scope in the handler):
   ```js
   setMessages(prev => {
     const withoutTemp = prev.filter(m => {
       if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
       if (m.id === msg.id) return false
       return true
     })
     const next = [...withoutTemp, msg]
     setGroupedMessages(imageGroupingService.groupMessages(next))
     return next
   })
   ```
   INSERT now rebuilds grouped (like UPDATE/DELETE) — fine because the optimistic path gives instant feedback; `groupMessages` runs once per message, not continuously.

   Note: the new temp-strip predicate is looser than the old one (drops *any* same-sender/same-media-type `temp_` row). This is per spec. It means if two of the same media type are in flight together, the first realtime echo may briefly remove both temps from `messages`; the still-pending one reappears when its own echo arrives.

Build after Part 1: **passes** (`✓ built in 3.99s`).

## Part 2 — Phase 4 image group layouts

1. **`src/pages/Chat.jsx`** — `renderMedia`'s `_isGroup` branch (`Chat.jsx:1661-1703`) replaced exactly as specified:
   - `visible = imgs.slice(0, 9)`, `overflow = total - 9`.
   - `getLayout(n)`: 1→`layout-1`, 2→`layout-2`, 3→`layout-3`, 4→`layout-4`, else→`layout-grid`.
   - Each thumb is a `div.chat-img-thumb` wrapping `<img draggable={false}>`; on the last thumb when `overflow > 0` a `.chat-img-overflow` badge shows `+{overflow}`.
   - Thumb click opens the lightbox (`setLightbox({ url: img.media_url, type: 'image', caption: '' })`).
   - Removed the old `chat-img-thumb-wrap`/`data-count` markup.

2. **`src/styles/chat-thread.css`** — appended the full layout block at the end of the file (`.chat-img-group` grid + `layout-1..4`, `.layout-grid`, `.chat-img-thumb`/`img`, `.chat-img-overflow`, mobile `@media (max-width: 899px)`).

## Verification

- `npx eslint src/pages/Chat.jsx`: **13 problems (9 errors, 4 warnings)** — identical to the pre-existing baseline; no errors reference the grouping or new layout code.
- `npm run build`: **passes** (`✓ built in 4.61s`).
- Layout confirmation (by `visible.length`, which drives `getLayout`):
  - 1 image → `layout-1` (single full-width thumb, max-height 280px).
  - 2 images → `layout-2` (side-by-side equal columns).
  - 3 images → `layout-3` (first thumb spans grid-row 1/3, two stacked right).
  - 4 images → `layout-4` (2×2).
  - 5–9 images → `layout-grid` (3-column grid).
  - 10+ images → **caveat below**.

## Caveat: the +N overflow badge

`ImageGroupingService` caps every group at `maxGroupSize: 9` (`chunk(..., 9)` in both `groupMessages` and `appendMessage`), so `_imageGroup.length` can never exceed 9 with the current default options. That means `overflow = total - 9` is always ≤ 0 and `showOverflow` is effectively always false with the current service config — 10 images render as two separate groups (`layout-grid` of 9 + `layout-1` of 1), not as "9 thumbnails + `+1`".

The JSX/CSS implement the specified behavior verbatim; to actually trigger the `+N` badge you'd need to either raise `maxGroupSize` (>9) in the service call used by Chat.jsx, or lower the visible/overflow threshold (e.g., `slice(0, 4)` / `overflow = total - 4`). Left as-is per the spec — flagging so it can be decided deliberately.
