Fix: tapping an emoji tile reopens the keyboard. It shouldn't — keyboard should only open via the explicit keyboard-swap button.

Root cause (already known from prior investigation, Chat.jsx:1975-1985): the [newMsg] effect unconditionally calls el.focus() whenever pendingEmojiCursorRef is set, and insertEmoji sets that ref on every single emoji tap — so every tap re-focuses the textarea and pops the keyboard back up.

Fix: in the [newMsg] effect, only call el.focus() (and the selectionRange/height logic that depends on focus) when the emoji picker is NOT currently open. When showEmoji is true, still update caret position tracking if needed for when the picker eventually closes, but do NOT call el.focus().

Specifically:
1. In the [newMsg] effect (Chat.jsx ~1975-1985), wrap the el.focus() call in a condition: only focus if !showEmoji.
2. el.setSelectionRange(at, at) — this can still run even without focus (it's fine on an unfocused element), OR gate it behind the same condition if it causes any issue when unfocused — use judgment, but test both ways if unsure.
3. The height auto-resize logic (el.style.height = ...) should still run regardless of focus state, since the textarea content changed and needs to resize visually even while blurred.
4. When the keyboard-swap button is tapped (setShowEmoji(false) + inputRef.current?.focus()) — this explicit focus call is UNCHANGED and remains the only way focus/keyboard reopens after picker use.
5. Double check: after this fix, does typing normally (keyboard already open, not using emoji picker) still work exactly as before? The effect should still focus/restore caret in that case since showEmoji is false during normal typing. Confirm no regression there.

After implementing, write to docs/response.md:
- Exact diff of the [newMsg] effect
- Confirm: tapping emoji tiles repeatedly while picker is open never triggers focus() or keyboard pop-up
- Confirm: normal typing (picker closed) still auto-focuses/restores caret correctly, no regression
- Confirm: keyboard-swap button still correctly reopens keyboard
- npx eslint + npm run build results