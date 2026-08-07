Fix: emoji grid too small on mobile — not enough emojis visible without scrolling inside the grid. No logic changes, CSS only.

In src/styles/chat-thread.css, inside the mobile @media block, apply these changes:

1. Increase overall picker height further:
Find:
  height: min(72dvh, 520px);
  max-height: min(72dvh, 520px);
Replace with:
  height: min(82dvh, 600px);
  max-height: min(82dvh, 600px);

2. Shrink the picker header to take less vertical space:
Find the rule: .chat-thread .emoji-picker-head
If it's not in the mobile block, add this inside the mobile @media block:
.chat-thread .emoji-picker-head {
  padding: 6px 10px;
  min-height: 0;
}

3. Shrink the recent strip height:
Find any padding/height rule for .chat-thread .emoji-recent-strip in the mobile block (or add if absent):
.chat-thread .emoji-recent-strip {
  min-height: 36px;
  max-height: 48px;
  padding: 2px 6px;
}

4. Shrink the category tab row:
Find or add in mobile block:
.chat-thread .emoji-tabs {
  min-height: 0;
  height: 38px;
}
.chat-thread .emoji-tab {
  height: 38px;
  min-width: 32px;
}

5. Make the emoji grid take ALL remaining space explicitly:
Find the mobile rule for .chat-thread .emoji-grid and ensure it has:
  flex: 1 1 0px;
  min-height: 0;
  max-height: none;
(These should already be there from earlier — confirm they are, and if max-height has a value other than none, change it to none)

6. Reduce emoji button size slightly on mobile to fit more per row:
Find: .chat-thread .emoji-btn { font-size: 24px; min-height: 44px; padding: 6px 2px; }
Replace with:
.chat-thread .emoji-btn { font-size: 22px; min-height: 38px; padding: 4px 2px; }

Run npm run build — confirm passes. No JS/logic changes needed.