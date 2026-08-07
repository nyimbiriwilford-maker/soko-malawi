Two clear bugs. Instructions for DeepSeek:

Instructions for DeepSeek — Emoji Picker: Persist on Input Tap + Cursor Position Fix
Bug 1 — Emoji picker dismisses when tapping the text input

Root cause: When the textarea is tapped, it fires focus → which triggers a keyboard show event → which runs logic that sets showEmoji(false) to close the picker.

Task 1 — Find the dismiss logic

In Chat.jsx, search for every place setShowEmoji(false) is called. List each one with its line number and the event/condition that triggers it. Report back the full list before touching anything.

Task 2 — Guard the dismiss on textarea focus/keyboard show

The picker must not close when:

The textarea receives focus
The keyboard appears (visualViewport resize fires while showEmoji is true)

Find the handler that calls setShowEmoji(false) on keyboard show / textarea focus and wrap it with a guard:

js
// BEFORE (example — exact code may differ)
if (keyboardVisible) {
  setShowEmoji(false)
}

// AFTER
if (keyboardVisible && !showEmoji) {
  setShowEmoji(false)
}

The picker should only close via:

The explicit dismiss/close button handler
The keyboard icon button handler
Navigating away from the chat

Do not close it on textarea focus, click, touchstart, or visualViewport resize.

Bug 2 — Emoji inserts at position 0 instead of cursor position (2nd, 3rd emoji onwards)

Root cause: After inserting the first emoji, the textarea loses focus (because the emoji button tap moves focus away). On the next insert, selectionStart is 0 (or the browser returns 0 for an unfocused element), so subsequent emojis go to the beginning.

Task 3 — Store and restore cursor position manually

In Chat.jsx, find the emoji insert function (where a tapped emoji character is inserted into the message). It likely reads inputRef.current.selectionStart.

Add a cursorPosRef to track the last known cursor position:

js
// Add near other refs
const cursorPosRef = useRef(null)

On the textarea, add onSelect and onKeyUp handlers to save cursor position whenever it changes:

jsx
onSelect={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
onKeyUp={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}

Then in the emoji insert function, replace selectionStart reads with cursorPosRef.current:

js
// BEFORE
const pos = inputRef.current.selectionStart ?? message.length
const newMsg = message.slice(0, pos) + emoji + message.slice(pos)
setMessage(newMsg)
// cursor restore
setTimeout(() => {
  inputRef.current.selectionStart = pos + emoji.length
  inputRef.current.selectionEnd = pos + emoji.length
}, 0)

// AFTER
const pos = cursorPosRef.current ?? message.length
const newMsg = message.slice(0, pos) + emoji + message.slice(pos)
setMessage(newMsg)
cursorPosRef.current = pos + emoji.length  // advance cursor ref
setTimeout(() => {
  if (inputRef.current) {
    inputRef.current.selectionStart = cursorPosRef.current
    inputRef.current.selectionEnd = cursorPosRef.current
  }
}, 0)

Also save cursor position inside the emoji insert function itself, after the insert, so the ref always reflects where the next emoji should land.

Task 4 — Also save cursor on textarea onClick and onTouchEnd
jsx
onClick={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
onTouchEnd={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}

This captures the cursor when the user taps inside the textarea while the picker is open.

Do NOT touch
The emoji picker open logic
lockedKbHeight
Any CSS files
The dismiss button and keyboard icon button handlers (those should still close the picker)
Deliverable

Report back with:

Full list of setShowEmoji(false) call sites (Task 1)
Which guard was added and on which line (Task 2)
Confirm cursorPosRef added and all 4 cursor-save events wired (Tasks 3 + 4)
Build passes