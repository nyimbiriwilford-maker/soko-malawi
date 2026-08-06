# Mobile emoji picker — proper flex layout (no hidden/overlapping sections)

Task source: `docs/claudehelp.md`. Scope: `src/styles/chat-thread.css` only. No JSX
structural changes and no effect on emoji insertion or caret logic; desktop unchanged.

## Root cause of the overlap

The picker is a flex column (`display:flex; flex-direction:column`) anchored above the
composer, but the inner sections were allowed to shrink by default (`flex: 0 1 auto`):
- header, recent/quick row, and category nav all had no `flex:none`, so when the panel
  hit its height cap they were free to shrink.
- the grid had `flex: 1 1 auto` with a fixed `max-height: min(44vh, 230px)` rather than a
  definite flex layout, and — critically — the panel had only a `max-height` (auto
  height), so flex-grow had no frame to distribute space into. Result: the grid could
  consume/rush past the panel's `overflow:hidden` rounded box, clipping or overlapping
  the recent row at the top and the category bar at the bottom.

## CSS/layout changes (`src/styles/chat-thread.css`)

Base rules (apply everywhere; desktop appearance unchanged because they only set flex
shrink behavior, not visual sizes):
- `.emoji-picker-head` → `flex: none`
- `.emoji-frequent` → `flex: none`
- `.emoji-tabs` → `flex: none`
- `.emoji-grid` → added `flex: 1 1 auto; min-height: 0` (kept `max-height: 210px/overflow-y`)

Mobile block (`@media (max-width: 899px)`):
- `.emoji-picker-panel` → definite **`height: min(50dvh, 380px)`** (+ same `max-height`).
  Using `dvh` lets the height track the mobile on-screen keyboard. A definite height is
  what gives the flex algorithm a real budget to allocate.
- `.emoji-grid` → genuine flex-remainder child: **`flex: 1 1 0px; min-height: 0;
  max-height: none; overflow-y: auto`**. It fills only the space left between the fixed
  sections and scrolls internally.

## How height is now allocated (mobile)

```
panel (flex column, definite 50dvh)
├── header        flex:none   → natural height, always visible at top
├── recent row    flex:none   → natural height, always visible, never pushed away
├── grid          flex:1; min-height:0; overflow-y:auto → fills the remainder, scrolls internally
└── category nav  flex:none   → natural height, pinned above the composer, always visible
```

## Checks requested by the task
- z-index: panel `z-index:200` remains above the composer (`z-index:5`) and messages.
- bottom positioning: `bottom:66px` keeps it above the composer input.
- max-height: now a definite `height` (`min(50dvh,380px)`) so flex distribution is exact
  and the grid can never exceed it.
- overflow:hidden clipping: the panel keeps `overflow:hidden` for rounded corners, but
  only the grid scrolls; fixed sections always fit because they're `flex:none` and the
  grid is `flex:1; min-height:0`.
- No change to `insertEmoji`, cursor restore, recent-emojis memory, close button, or
  mobile touch sizing — those flows are untouched.

## Verification
- `npx eslint src/pages/Chat.jsx` → **12 problems (8 errors, 4 warnings)** — identical
  pre-existing baseline; none reference the edited lines (CSS only edit this task).
- `npm run build` → **passes** (`✓ built in 2.95s`).