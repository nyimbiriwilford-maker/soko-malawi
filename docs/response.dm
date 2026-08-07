# Chat media placeholder: blurred preview instead of opaque

Task source: `docs/claudehelp.md`.

## Task 1 + 2 — Blurred `<img>` added to both image and video placeholders
In `renderMedia` (`Chat.jsx`), the `_pendingLoad` placeholder now renders a blurred preview layer above the icon/text:
```jsx
<div className="chat-media-placeholder" onClick={/* tap-to-load handler unchanged */}>
  <img
    src={msg.media_url}
    className="chat-media-placeholder-blur"
    draggable={false}
    alt=""
  />
  <div className="chat-media-placeholder-inner">
    {isVideo ? <Video size={28} strokeWidth={2} /> : <ImageIcon size={28} strokeWidth={2} />}
    <span>Tap to load {isVideo ? 'video' : 'photo'}</span>
  </div>
</div>
```
Both image and video branches share this single placeholder. For video, `msg.media_url` points to the video file so the `<img>` blur won't render a frame — it stays transparent and the dark base + overlay icon show instead (as specified).

## Task 3 — CSS updated (`chat-thread.css`)
- `.chat-media-placeholder`: now `position: relative; overflow: hidden; background: #000`, removed solid bubble-color background.
- `.chat-media-placeholder-blur` (new): absolutely positioned, `inset: 0`, `object-fit: cover`, `filter: blur(18px)`, `transform: scale(1.1)` (kills edge halos), `opacity: 0.6`.
- `.chat-media-placeholder-inner`: now `position: relative; z-index: 1; color: #fff`.
- `.chat-media-placeholder-inner svg`: `opacity: 0.9`.

## Do-not-touch compliance
`_pendingLoad` logic, onClick tap-to-load handler, and emoji/input-bar changes untouched.

## Deliverable
1. Blurred `<img class="chat-media-placeholder-blur">` added to placeholder (covers image + video): ✓
2. CSS blur-layer styles updated: ✓
3. Build: `npm run build` → `✓ built in 2.94s`. Passes.