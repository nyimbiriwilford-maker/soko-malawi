Task 1 — Reproduce precisely (read only, no code changes)

Open the chat on a physical iOS device (not simulator). Do the following sequence and note exactly when the clipping appears:

Tap the text input → keyboard opens
Tap the emoji button → picker opens, keyboard closes, bar lifts
Watch the send button during the transition (keyboard sliding down)
Tap anywhere to close the picker → bar drops back

Answer: does the clipping appear during step 3 (mid-animation) and then recover? Or is it persistent after the picker is fully open?

If mid-animation only → it is a compositing artifact. Proceed to Task 2.
If persistent → there is a layout bug we haven't found yet. Report the exact lockedKbHeight value on that device and the viewport dimensions.
Task 2 — Apply the compositing fix

iOS Safari sometimes fails to repaint a position: relative element that shifts via bottom while the keyboard animation is in progress. The fix is to promote the input bar to its own compositor layer.

In Chat.jsx, find the S.inputBar style object and add willChange:

jsx
// BEFORE (the relevant part of S.inputBar)
position: 'relative',
bottom: isMobile && showEmoji && lockedKbHeight > 0 ? lockedKbHeight : 0,

// AFTER
position: 'relative',
bottom: isMobile && showEmoji && lockedKbHeight > 0 ? lockedKbHeight : 0,
willChange: isMobile && showEmoji ? 'transform' : 'auto',

willChange: 'transform' tells Safari to promote this element to a GPU layer when the picker is open, which forces a clean repaint and eliminates the mid-animation clip. It is removed ('auto') when the picker is closed so it doesn't permanently consume GPU memory.

Task 3 — If Task 2 doesn't fix it: add a transitionEnd scroll nudge

If the bar is still clipped after the compositor fix, the issue is that visualViewport.height settles after the CSS animation finishes, leaving a one-frame gap. Add this inside the emoji onClick handler, after setShowEmoji(true):

js
// After setShowEmoji(true)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0)
  })
})

The double-rAF waits two frames — one for React's commit, one for the browser's layout — then nudges the scroll position, which forces Safari to recomposite the viewport and repaint the input bar at its correct position.

Only apply Task 3 if Task 2 alone does not resolve it. Do not apply both simultaneously — test Task 2 first.

Do NOT touch
Padding, gap, min-width — already confirmed clean.
--chats-vvh listener — already synchronous.
lockedKbHeight initialization — already correct.
Deliverable

Report back with:

Answer to Task 1 (mid-animation vs persistent)
Whether willChange from Task 2 resolved it
If Task 3 was needed, confirm whether the double-rAF scroll nudge fixed it