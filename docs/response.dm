# Chat media placeholder: WhatsApp-style blur

Task source: `docs/claudehelp.md`.

## Task 2 — JSX updated (renderMedia placeholder)
`_pendingLoad` placeholder now uses a WhatsApp-style download button circle + label instead of the raw media icon:
```jsx
<div className="chat-media-placeholder-inner">
  <div className="chat-media-placeholder-btn">
    <Download size={26} strokeWidth={2} />
  </div>
  <span className="chat-media-placeholder-label">
    Tap to load {isVideo ? 'video' : 'photo'}
  </span>
</div>
```
There is no `Icon.download` helper in this project, so I used `<Download>` from lucide-react. Added `Download` to the lucide import in `Chat.jsx` (line 23). The blurred `<img class="chat-media-placeholder-blur">` layer stays.

## Task 1 — CSS updated (`chat-thread.css`)
- `.chat-media-placeholder`: background → `#1a1a1a` (darker).
- `.chat-media-placeholder-blur`: heavier blur `24px`, `scale(1.15)`, `opacity: 0.45`.
- `.chat-media-placeholder::after`: dark overlay `rgba(0,0,0,0.45)` (new), `z-index: 0`.
- `.chat-media-placeholder-inner`: `z-index: 2`, 12px/500 weight label, gap 8.
- `.chat-media-placeholder-btn` (new): 54px translucent circle, white ring + `backdrop-filter`.
- `.chat-media-placeholder-btn svg` (new): 26px white.
- `.chat-media-placeholder-label` (new): 11px, `rgba(255,255,255,0.85)`.

## Do-not-touch compliance
`_pendingLoad` logic, onClick tap-to-load handler, and emoji/input-bar changes untouched.

## Deliverable
1. CSS darker overlay + heavier blur + download circle button: ✓
2. JSX download button circle + label: ✓ (`Download` imported from lucide-react)
3. Build: `npm run build` → `✓ built in 3.15s`. Passes.