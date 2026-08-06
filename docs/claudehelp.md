Investigate and permanently improve the chat message composer to provide a modern, seamless typing and emoji experience. Do not implement quick hacks—identify the root cause first and preserve the existing architecture.

Current issue:
Typing becomes difficult when inserting emojis. The flow between typing, opening the emoji picker, selecting emojis, and continuing to type is not smooth.

Requirements:

1. Investigate the current implementation:
   - Trace the entire message composer lifecycle.
   - Inspect the textarea/input, emoji picker, keyboard handling, cursor management, focus handling, and message state.
   - Identify why typing is interrupted after selecting emojis.
   - Check for unnecessary re-renders, component remounts, focus loss, controlled/uncontrolled input issues, stale refs, or cursor position resets.

2. Implement a professional messaging experience:
   - User types normally.
   - User opens the emoji picker without losing the current text.
   - Selecting an emoji inserts it exactly at the current cursor position (not always at the end).
   - After emoji insertion, the input immediately regains focus.
   - The cursor is placed directly after the inserted emoji.
   - The user can continue typing naturally without clicking the input again.
   - Multiple emojis can be inserted consecutively.
   - User can move the cursor anywhere in the text and insert emojis at that location.
   - Existing text must never be overwritten.
   - Preserve undo/redo behavior where possible.

3. UX improvements:
   - Emoji picker should not close unexpectedly while selecting emojis.
   - Clicking outside closes the picker.
   - Pressing Esc closes the picker.
   - Maintain smooth scrolling and input height.
   - Preserve draft text while the picker is open.
   - Ensure mobile and desktop behavior are both smooth.

4. Performance:
   - Prevent unnecessary re-renders while typing.
   - Avoid losing cursor position after state updates.
   - Keep typing responsive even with long messages.

5. After implementation, provide:
   - Root cause(s).
   - Files modified.
   - Why typing was interrupted.
   - Why the new implementation is permanent.
   - Any performance or UX improvements made.

The final result should feel like WhatsApp, Telegram, Messenger, or Discord: users should be able to type, insert emojis anywhere in the message, continue typing immediately, and never lose focus or cursor position.