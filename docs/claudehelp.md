Fix: emoji picker is clipped on mobile because it is position:absolute inside overflow:hidden parent. Fix by switching to position:fixed on mobile only.

In src/styles/chat-thread.css, inside the mobile @media block, find the .chat-thread .emoji-picker-panel rule and replace it entirely with:

.chat-thread .emoji-picker-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 100%;
  height: min(82dvh, 600px);
  max-height: min(82dvh, 600px);
  z-index: 1100;
  border-radius: 18px 18px 0 0;
  touch-action: pan-y;
}

This removes the left:6px/right:6px/bottom:66px positioning (which was relative to the parent) and instead pins the picker to the bottom of the screen, full width, with a top-rounded card style. z-index 1100 puts it above the chat input bar.

Also in src/styles/chat-thread.css, find the desktop rule for .chat-thread .emoji-picker-panel (the base rule, NOT inside a media query):
Confirm it still has position: absolute — do NOT change the desktop rule, only the mobile override.

Run npm run build — confirm passes.