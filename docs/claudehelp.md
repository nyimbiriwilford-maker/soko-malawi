Two improvements to the emoji picker. Investigation first, then fix.

═══════════════════════════════════
INVESTIGATION
═══════════════════════════════════

1. Show the current ep-wrap JSX structure — specifically the top of the picker (is there a header row already, or does it go straight into ep-recent?).

2. Show the message input (textarea) in Chat.jsx — its current value binding, onChange handler, and ref. Specifically:
   - What state variable holds the message text? (likely `newMsg` or similar)
   - What is the ref on the textarea (inputRef?)
   - Does insertEmoji currently append to that state variable or does it manipulate the DOM directly?
   - Show the full insertEmoji function.

Do not fix anything yet.

═══════════════════════════════════
FIX A — Close button on picker
═══════════════════════════════════

After investigation, add a header row to ep-wrap with a close button and the current category label.

In Chat.jsx, find the opening of ep-wrap content (right after <div className="ep-wrap" ...>), add as the FIRST child:

<div className="ep-header">
  <span className="ep-header-label">
    {EMOJI_BY_ID[emojiTab]?.label || 'Emoji'}
  </span>
  <button
    type="button"
    className="ep-close"
    onClick={() => setShowEmoji(false)}
    aria-label="Close emoji picker"
  >
    ✕
  </button>
</div>

Add CSS at the end of chat-thread.css:

.chat-thread .ep-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 6px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.chat-thread .ep-header-label {
  font-size: 13px;
  font-weight: 600;
  color: #1a7a4a;
  letter-spacing: 0.2px;
}

.chat-thread .ep-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.07);
  color: #555;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
}

.chat-thread .ep-close:active {
  background: rgba(0,0,0,0.15);
}

@media (prefers-color-scheme: dark) {
  .chat-thread .ep-header-label { color: #4caf82; }
  .chat-thread .ep-close { background: rgba(255,255,255,0.1); color: #ccc; }
}

═══════════════════════════════════
FIX B — Real-time emoji preview in typing box
═══════════════════════════════════

The user wants to keep the picker OPEN while inserting emojis and see them appear in the message box in real time. Currently insertEmoji likely closes the picker or the picker closes on input focus.

Show the full insertEmoji function first (from investigation step 2), then:

1. Make sure insertEmoji does NOT close the picker. Find inside insertEmoji any call to setShowEmoji(false) and remove it if present.

2. Make sure the textarea onFocus does NOT close the picker when the picker itself triggered the focus. Currently we added onFocus={() => { if (showEmoji) setShowEmoji(false) }} — this will close the picker when insertEmoji tries to refocus the input after inserting. 

Replace that onFocus with a smarter version:
Find:
onFocus={() => { if (showEmoji) setShowEmoji(false) }}

Replace with:
onFocus={e => {
  // Only close picker if focus came from user tapping the input directly
  // not from insertEmoji programmatically focusing it
  if (showEmoji && e.relatedTarget?.classList?.contains('ep-btn')) return
  if (showEmoji) setShowEmoji(false)
}}

This means: if focus on the textarea came FROM an emoji button (ep-btn), don't close the picker. If the user tapped the textarea directly, close the picker.

3. In insertEmoji, after inserting the emoji into the message state, programmatically focus the input so the cursor stays active. Show insertEmoji and confirm it already calls inputRef.current?.focus() or similar — if not, add it.

4. Keep the picker open when emoji is tapped — confirm setShowEmoji is NOT called inside insertEmoji. If it is, remove that call.

5. The ep-backdrop currently closes the picker on any tap outside. ep-btn buttons are INSIDE ep-wrap so they won't trigger the backdrop. Confirm this is correct (ep-btn is a child of ep-wrap which is above the backdrop at z-index 1200 vs 1199). No change needed here.

═══════════════════════════════════
VERIFICATION
═══════════════════════════════════

Run npx eslint src/pages/Chat.jsx and npm run build. Report both.

Confirm:
- grep -n "ep-header\|ep-close" src/pages/Chat.jsx src/styles/chat-thread.css — appears in both
- grep -n "setShowEmoji(false)" src/pages/Chat.jsx — confirm insertEmoji is NOT in this list
- grep -n "insertEmoji" src/pages/Chat.jsx — show the full function location and confirm it keeps picker open
- Build passes, no new lint errors