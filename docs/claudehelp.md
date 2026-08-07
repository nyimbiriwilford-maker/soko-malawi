Two UX fixes for the new emoji picker (ep-wrap). Investigation first, then fix.

═══════════════════════════════════
INVESTIGATION
═══════════════════════════════════

1. Show how showEmoji is currently set to false — what triggers closing the picker right now (grep -n "setShowEmoji(false)" src/pages/Chat.jsx and show all call sites).

2. Show the emojiPickerRef usage — is there already a click-outside handler that closes the picker? grep -n "emojiPickerRef" src/pages/Chat.jsx.

3. Show the chat input bar JSX (the div containing the Message... input, emoji button, send button) — specifically its position, z-index, and whether it sits above or below ep-wrap in the DOM order.

4. On mobile, when the user taps the message input box after opening the emoji picker, does the keyboard open? If so, does ep-wrap (position:fixed; bottom:0) stay visible above the keyboard or get pushed behind it? Check if there is any existing keyboard-detection logic (visualViewport resize handler in Chat.jsx already tracks this via --chat-vvh).

═══════════════════════════════════
FIX A — Easy dismissal
═══════════════════════════════════

After investigation, apply:

1. Add a backdrop behind the picker. In the JSX, wrap the existing ep-wrap with a fragment and add a backdrop div before it:

Find:
{showEmoji && (
  <div
    ref={emojiPickerRef}
    className="ep-wrap"
    onClick={e => e.stopPropagation()}
  >

Replace with:
{showEmoji && (
  <>
    <div className="ep-backdrop" onClick={() => setShowEmoji(false)} />
    <div
      ref={emojiPickerRef}
      className="ep-wrap"
      onClick={e => e.stopPropagation()}
    >

Find the closing of the showEmoji block:
  </div>
)}

Replace with:
    </div>
  </>
)}

2. Add CSS for the backdrop at the end of chat-thread.css:

.chat-thread .ep-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1199;
  background: transparent;
  -webkit-tap-highlight-color: transparent;
}

This means tapping anywhere outside the picker closes it instantly. z-index 1199 puts it just below ep-wrap (1200).

3. Also close on Escape key — find the existing global keydown handler in Chat.jsx (there should be one handling Escape for lightbox etc). Add to it:

if (e.key === 'Escape' && showEmoji) { setShowEmoji(false); return }

Place this BEFORE the existing Escape checks so it fires first.

═══════════════════════════════════
FIX B — Picker works well with the typing box
═══════════════════════════════════

The picker is position:fixed; bottom:0. The input bar sits above it in the page flow. On mobile, when the keyboard is open, the visualViewport shrinks — ep-wrap at bottom:0 fixed will sit above the keyboard correctly IF bottom:0 is relative to the visual viewport. On iOS Safari this works. On Android Chrome, fixed elements can sit behind the keyboard.

Fix: use the existing --chat-vvh visualViewport tracking to position ep-wrap correctly.

In src/styles/chat-thread.css, find:
.chat-thread .ep-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;

Add bottom positioning via JS instead. In Chat.jsx, find the visualViewport useEffect that sets --chat-vvh and --chat-vv-top. After the existing setProperty calls inside the apply() function, add nothing — instead, handle ep-wrap bottom positioning via CSS env():

Replace bottom: 0 in the ep-wrap CSS with:
  bottom: env(safe-area-inset-bottom, 0px);

AND add this rule so ep-wrap repositions when the keyboard is up (visualViewport height shrinks):

In Chat.jsx, in the same visualViewport apply() function that sets --chat-vvh, also set a new var:
  root.style.setProperty('--chat-kb-offset', `${window.innerHeight - (vv ? vv.height : window.innerHeight)}px`)

Then in chat-thread.css, update ep-wrap bottom to:
  bottom: var(--chat-kb-offset, 0px);

This means when the keyboard opens (innerHeight - visualViewport.height > 0), the picker lifts above the keyboard automatically.

Also: when the emoji picker is open and the user taps the input box to type, close the picker:

Find the message input's onFocus handler in Chat.jsx (the <textarea> or <input> for the message). If there is already an onFocus, add to it:
  if (showEmoji) setShowEmoji(false)

If there is no onFocus, add:
  onFocus={() => { if (showEmoji) setShowEmoji(false) }}

This way tapping the input box closes the picker and lets the keyboard take over naturally.

═══════════════════════════════════
VERIFICATION
═══════════════════════════════════

Run npx eslint src/pages/Chat.jsx and npm run build. Report both.

Confirm:
- grep -n "ep-backdrop" src/pages/Chat.jsx src/styles/chat-thread.css — appears in both
- grep -n "chat-kb-offset" src/pages/Chat.jsx src/styles/chat-thread.css — appears in both
- grep -n "setShowEmoji(false)" src/pages/Chat.jsx — show all call sites including the new ones