# Emoji picker: persist on input tap + cursor position fix

Task source: `docs/claudehelp.md`. Implemented + verified.

## Task 1 — Full list of `setShowEmoji(false)` call sites

| Line | Trigger / condition | Action |
|---|---|---|
| 524 | `Escape` key (first branch) | keep (explicit dismiss) |
| 528 | `Escape` key (fallback chain) | keep (explicit dismiss) |
| 590 | document `mousedown` outside `.ep-wrap` | **guarded** (Task 2) |
| 1080 | `openActions(msg)` (message action sheet) | keep |
| 3010 | messages list `onClick` | keep |
| 3893 | `ep-backdrop` `onClick` | keep (explicit dismiss) |
| 3908 | keyboard‑swap icon button | keep (explicit dismiss) |
| 3917 | ✕ close button | keep (explicit dismiss) |
| 4061 | attach button `onClick` | keep |
| 4071 | offer button `onClick` | other |
| 4087 | **textarea `onFocus`** (picker closed on input-focus) | **removed (Bug 1)** |
| 4117 | emoji button `onClick` closing branch | keep (toggle) |

The two persistent offenders for Bug 1 were the **textarea `onFocus`** (dismissed on focus) and the **document `mousedown` outside‑click** handler (dismissed on any tap outside `.ep-wrap`, which included tapping the textarea). Both fixed.

## Task 2 — Guards added

### 2a. Textarea no longer closes on focus (`Chat.jsx:4079–4088`)
The `onFocus` prop (which ran `if (showEmoji) setShowEmoji(false)`) was **removed**. Focus/keyboard showing no longer dismisses the picker.

### 2b. Outside-click keeps picker open on composer tap (`Chat.jsx:586–595`)
```js
function handler(e) {
  if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
    // Tapping the textarea/composer to move the cursor must NOT dismiss the
    // picker (Bug 1) — only dismiss on a true outside area.
    if (e.target?.closest && e.target.closest('.chat-composer')) return
    setShowEmoji(false)
  }
}
```
Now a tap inside the composer (textarea / emoji button) does **not** close the picker; it stays open so the user can place the cursor and keep inserting emojis. It will only close via the explicit buttons/backdrop (✕, keyboard icon, `ep-backdrop`), Escape, navigating away, or a genuine outside‑of‑composer tap.

## Tasks 3 + 4 — `cursorPosRef` (Bug 2)

### Ref added (`Chat.jsx:419`)
```js
const cursorPosRef = useRef(null) // survives blur/unfocus (emoji inserts)
```

### Textarea now records the cursor on all four events (`Chat.jsx:4079–4088`)
```jsx
onSelect={()     => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
onKeyUp={()     => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
onClick={()     => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
onTouchEnd={()  => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
```
These capture the caret when the user taps/types in the textarea (including while the picker is open), so the position survives blur.

### `insertEmoji` reads the tracked cursor (`Chat.jsx:1958–1967`)
```js
const pos = cursorPosRef.current ?? newMsg.length
const next = newMsg.slice(0, pos) + emoji + newMsg.slice(pos)
pendingEmojiCursorRef.current = pos + emoji.length
cursorPosRef.current = pos + emoji.length
handleTyping(next)
```
Replaces the DOM `inputRef.current.selectionStart/selectionEnd` reads (which return `0` on the unfocused textarea). The ref is advanced after every insert, so 2nd/3rd/n+1th emojis land after the previous one instead of jumping to position 0.

## Deliverable answers
1. **Call sites:** all listed above; the two Bug‑1 offenders (textarea `onFocus` and composer tap via outside‑click) were fixed.
2. **Guard added:** (a) removed the `onFocus` dismiss, (b) `.chat-composer` guard in the `mousedown` outside‑click handler (`Chat.jsx:587–595`).
3. **`cursorPosRef` added; all 4 events wired:** `onSelect`, `onKeyUp`, `onClick`, `onTouchEnd` + advanced inside `insertEmoji`. ✓

Do-not-touch compliance: emoji picker open logic, `lockedKbHeight`, CSS, and the dismiss/✅ keyboard‑icon button handlers were not modified. Build:
- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)** — unchanged baseline, 0 new.
- `npm run build` → `✓ built in 3.73s`. Passes.