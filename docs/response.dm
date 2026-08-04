# Chat video bubble — tap-to-fullscreen + play hint (applied)

## Changes

### `src/pages/Chat.jsx` — `renderMedia` video branch (lines 1611–1628)
Replaced the inline `controls` video with a tappable poster-style card that opens the existing lightbox:
```jsx
if (type === 'video') {
  return (
    <div
      className="media-video-wrap"
      onClick={e => { e.stopPropagation(); setLightbox({ url, type: 'video', caption: caption || '' }) }}
    >
      <video src={url} playsInline preload="metadata" muted />
      <div className="media-video-play-hint" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>
  )
}
```
- Native controls removed; video is `muted` (plays as a preview/thumbnail on some browsers) and tapping the wrapper opens the fullscreen lightbox (`<video controls autoPlay>` + close/download/caption) that already exists.
- `caption` **is in scope**: it's the second param of `renderMedia(msg, caption)` (Chat.jsx:1584), same as the image branch uses.

### `src/styles/chat-thread.css` (after `.media-video-wrap` @ lines 529–536)
- Added `cursor: pointer` to `.media-video-wrap`.
- Added `.media-video-play-hint` — centered 48px circular semi-transparent play button, `pointer-events: none` so taps pass to the wrapper.

## Verification
- `npx eslint src/pages/Chat.jsx`: 13 problems (9 errors, 4 warnings) — identical to the pre-existing baseline; no new errors.
- `npm run build`: **passes** (3.63s).
