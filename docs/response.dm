# Emoji picker: block keyboard on textarea tap

Task source: `docs/claudehelp.md`. Implemented + verified on `Chat.jsx:4086`.

## Task 1 — `readOnly={showEmoji}` added to textarea
The composer `<textarea ref={inputRef} ... />` now has `readOnly={showEmoji}`. When the picker is open, `readOnly` suppresses the native keyboard on iOS/Android while still allowing touch tap to reposition the cursor.

## Task 2 — Re-enable input immediately when picker closes
No extra logic needed — `readOnly` is driven directly by `showEmoji` state, so once the picker closes (`setShowEmoji(false)`) the textarea returns to writable automatically. Confirmed that **no** `disabled` or `pointerEvents:none` was added anywhere.

## Task 3 — `onFocus` blur guard added
Added a belt-and-suspenders guard on `onFocus`:
```jsx
onFocus={(e) => {
  if (showEmoji) {
    e.target.blur()
    return
  }
}}
```
`readOnly` handles iOS; this blur-on-focus guard handles Android browsers that still briefly surface the keyboard.

## Deliverable answers
1. **`readOnly={showEmoji}`**: ✓ added to the composer textarea (`Chat.jsx:4089`).
2. **`onFocus` blur guard:** ✓ added (`Chat.jsx:4094–4099`).
3. **No `disabled` / `pointerEvents`:** ✓ confirmed — only the `readOnly` prop and `onFocus` guard were introduced.

Do-not-touch compliance: `cursorPosRef` logic, existing `setShowEmoji(false)` call sites, CSS, and dismiss-button handlers were left intact. Build:
- `npm run build` → `✓ built in 4.67s`. Passes.