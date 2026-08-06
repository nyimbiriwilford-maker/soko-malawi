# Fix: chat list (conversations panel) cannot scroll on mobile

Task source: `docs/claudehelp.md`.

## What was done

### 1. `src/pages/ChatsLayout.jsx`
- Added a visualViewport-tracking `useEffect` as the **first hook** in the component (before the existing scroll-reset effect and before any return). It sets `--chats-vvh` (visual viewport height) and `--chats-vv-top` (keyboard/browser-chrome offset) on `document.documentElement`, re-applies on `visualViewport` resize/scroll, and cleans up listeners + removes the vars on unmount.
- `useEffect` was already imported; no import change needed.

### 2. `src/styles/chats.css`
- Main mobile `.chats-shell` rule (`@media max-width: 899px`):
  - `top: var(--chats-vv-top, 0px)`
  - `height: var(--chats-vvh, 100dvh)`
  - `max-height: var(--chats-vvh, 100dvh)`
  - (was `--chat-vv-top` / `--chat-vvh`, the thread-owned vars)
- List fallback `.chats-shell[data-has-thread='false']` rule: same three properties switched to the new `--chats-vvh` / `--chats-vv-top` vars (previously hard `100vh`/`100dvh`/`top:0`).
- Updated the comment above the mobile rule to reflect that the shell vars are set by ChatsLayout.jsx.

**Variable separation respected:** the thread keeps `--chat-vvh` / `--chat-vv-top` (set by Chat.jsx, applied to `.chat-page.chat-thread` at Chat.jsx:2549–2551); the list shell uses the separate `--chats-vvh` / `--chats-vv-top` (set by ChatsLayout.jsx). No mixing.

## Results

### 5. `npx eslint src/pages/ChatsLayout.jsx`
```
(no output — passes with zero errors/warnings)
```

### 5. `npm run build`
```
vite v8.0.14 building client environment for production...
✓ 2105 modules transformed.
✓ built in 3.58s
```
Success. ChatsLayout chunk emitted (`dist/assets/ChatsLayout-*.js/.css`).

### 6. grep matches: `chats-vvh\|chats-vv-top`

`src/pages/ChatsLayout.jsx`:
- 34: `root.style.setProperty('--chats-vvh', ...)`
- 35: `root.style.setProperty('--chats-vv-top', ...)`
- 44: `root.style.removeProperty('--chats-vvh')`
- 45: `root.style.removeProperty('--chats-vv-top')`

`src/styles/chats.css`:
- 87: comment (vars set by ChatsLayout.jsx)
- 91: `top: var(--chats-vv-top, 0px);`
- 96: `height: var(--chats-vvh, 100dvh);`
- 97: `max-height: var(--chats-vvh, 100dvh);`
- 104: `top: var(--chats-vv-top, 0px);`
- 105: `height: var(--chats-vvh, 100dvh);`
- 106: `max-height: var(--chats-vvh, 100dvh);`

## Root cause addressed
On mobile the shell was fixed at `100dvh`, which can exceed the *visible* viewport while the on-screen keyboard / browser chrome is shown (and never corrected), clipping the list so it could not scroll the tail. The thread already handled this via `--chat-vvh`; the list now gets the same visualViewport-driven height correction through `--chats-vvh`, so the `.chat-list-scroll` container always fits the visible viewport and scrolls properly.
