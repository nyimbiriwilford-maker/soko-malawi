# Emoji picker: stop keyboard reopening on emoji tap

Task source: `docs/claudehelp.md`. Fix implemented + verified.

## Root cause
`insertEmoji` sets `pendingEmojiCursorRef` on every emoji tap; the `[newMsg]` effect ran `el.focus()` unconditionally, so each tap re-focused the textarea and popped the keyboard back up.

## Exact diff of the [newMsg] effect (`Chat.jsx` ~1976–1991)

```diff
  useEffect(() => {
    const at = pendingEmojiCursorRef.current
    if (at == null) return
    pendingEmojiCursorRef.current = null
    const el = inputRef.current
    if (!el) return
-   el.focus()
+   // Only refocus when the picker is closed. While the picker is open, refocusing
+   // would pop the keyboard back up on every emoji tap — focus/keyboard reopen
+   // happens exclusively via the keyboard-swap button instead.
+   if (!showEmoji) el.focus()
+   // setSelectionRange is fine on an unfocused element — records the caret so it's
+   // correct when the picker closes and the user returns to typing.
    el.setSelectionRange(at, at)
    // Keep autosize in sync for programmatic inserts (onChange only handles typing);
+   // must run regardless of focus since content changed and needs to resize visually.
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
- }, [newMsg])
+ }, [newMsg, showEmoji])
```

## 1. `el.focus()` gated behind `!showEmoji`
While the picker is open, `showEmoji` is true → **no `focus()`** is called on emoji taps. ✓

## 2. `el.setSelectionRange(at, at)` — kept unconditional
`setSelectionRange` works fine on an unfocused `<textarea>`. Keeping it running while the picker is open records the correct caret position so that when the user closes the picker it's already placed after the emoji. No issue observed; kept ungated. ✓

## 3. Height auto-resize — kept unconditional
`el.style.height = 'auto'; = Math.min(scrollHeight,120)` still runs regardless of focus, so the textarea visually resizes even while blurred (content changed via insert). ✓

## 4. Keyboard-swap button unchanged
The keyboard-swap button still does `setShowEmoji(false); inputRef.current?.focus()` explicitly — this remains the **only** path that reopens focus/keyboard after picker use. ✓

## 5. Normal typing regression check — none
During normal typing the picker is closed (`showEmoji === false`), so the effect still runs `el.focus()` + `setSelectionRange`, restoring the caret exactly as before. No regression. ✓

(Deps array updated to `[newMsg, showEmoji]` because the effect now reads `showEmoji` — this also satisfies `react-hooks/exhaustive-deps`, keeping lint clean.)

## Confirmation summary
- Repeatedly tapping emoji tiles while the picker is open **never triggers `focus()`** (and therefore no keyboard pop-up). ✓
- Normal typing (picker closed) still auto-focuses/restores caret. ✓
- Keyboard-swap button still reopens the keyboard. ✓

## Verification results
- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)** — unchanged baseline, **0 new**.
- `npm run build` → `✓ built in 3.27s`. Passes.