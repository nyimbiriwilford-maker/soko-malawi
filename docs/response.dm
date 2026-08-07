# Emoji input-bar clip: compositor-layer fix (Task 2)

Task source: `docs/claudehelp.md`. Implemented Task 2; Task 1 requires physical-device repro I cannot run; Task 3 deferred (only if Task 2 fails, tested on-device).

## Task 1 — Reproduce precisely
**Not executable in this environment** (requires a physical iOS device; no device access). The on-device sequence (tap input → keyboard opens → emoji button → picker open/keyboard slides down → watch send button → close picker) must be run by the user to answer **mid-animation vs persistent**. As instructed:
- mid-animation only → compositing artifact (Task 2 targets this);
- persistent → report exact `lockedKbHeight` + viewport dims (Task 2 may still be worthwhile; the layout math is already confirmed overflow-free).

## Task 2 — Compositor fix applied

`S.inputBar` is a **static, non-reactive const** (`Chat.jsx:4125`) shared by every input-bar render, so `willChange` (which must be reactive to `isMobile && showEmoji`) cannot live there. It is therefore added to the `.chat-input-bar` **inline style** (`Chat.jsx:4029`), where `bottom` already lives:

```diff
  <div className="chat-input-bar" style={{
    ...S.inputBar,
    position: 'relative',
    bottom: isMobile && showEmoji && lockedKbHeight > 0 ? lockedKbHeight : 0,
+   willChange: isMobile && showEmoji ? 'transform' : 'auto',
  }}>
```
- Picker open on mobile → `willChange: 'transform'` → Safari promotes the bar to a GPU layer → clean repaint, eliminating the mid-animation clip.
- Picker closed / desktop → `'auto'` → layer is released, no permanent GPU memory.

## Task 3 — Scroll nudge (NOT applied, deferred)
Per the task: only if Task 2 alone does not resolve the issue, and only on-device. The double-rAF `window.scrollTo(0,0)` nudge is documented for later use; it was intentionally **not** applied simultaneously with Task 2.

## Do NOT touch (honored)
- Padding, gap, min-width on the input bar: untouched.
- `--chats-vvh` listener: untouched (already synchronous).
- `lockedKbHeight` initialization: untouched (340 fallback).

## Deliverable answers
1. **Task 1 result:** pending — requires on-device repro (mid-animation vs persistent).
2. **Did Task 2's `willChange` resolve it?** Pending on-device verification. Code applied, lint/build clean.
3. **Was Task 3 needed?** Not determined yet — only if Task 2 fails on-device; the double-rAF nudge is specified but not applied.

## Verification results
- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)** — unchanged baseline, **0 new**.
- `npm run build` → `✓ built in 3.33s`. Passes.