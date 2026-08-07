# Two UX fixes for the emoji picker (ep-wrap)

Task source: `docs/claudehelp.md`. Investigation first, then fix.

## INVESTIGATION

1. **How `showEmoji` is set to false (before):** `setShowEmoji(false)` was called at: Escape handler (`Chat.jsx:513`), click-outside mousedown handler (`:574`), `:1061`, `:2989` (lightbox/overlay), `:4022` (attach toggle), `:4032` (offer toggle).

2. **Click-outside:** Yes — there is already a `mousedown` listener on `document` (`Chat.jsx:566–573`) that closes the picker when a tap lands outside `emojiPickerRef`. It uses `mousedown` (device-agnostic-ish) but can be flaky where the tap begins on a scrollable surface; the new dedicated backdrop gives a reliable full-surface tap target.

3. **Chat input bar:** `S.inputBar` = `position: static` (in flow), `z-index: 5` (`Chat.jsx:4096`). It renders BELOW the picker in the DOM (picker comes first, `z-index:1200`), so the fixed `ep-wrap` overlays the input bar when open. `.chat-composer` textarea at `Chat.jsx:4032–4043`, no prior `onFocus`.

4. **Keyboard + picker:** The picker is `position:fixed; bottom:0`. When the input is tapped to type, the soft keyboard opens and shrinks the visual viewport. On iOS Safari, `bottom:0` is relative to the visual viewport (works); on Android Chrome fixed elements can end up behind the keyboard. Chat.jsx already tracks the visual viewport via `--chat-vvh` (`Chat.jsx:444–466`), so we reuse that mechanism for the picker.

## FIX A — Easy dismissal

- **Backdrop:** wrapped `ep-wrap` in a fragment and added `<div className="ep-backdrop" onClick={() => setShowEmoji(false)} />` before it (`Chat.jsx:3871–3872`). Closing tag updated to `</div></>`.
- **CSS:** appended `.chat-thread .ep-backdrop` → `position:fixed; inset:0; z-index:1199; background:transparent` (just below `ep-wrap`'s 1200).
- **Escape:** added `if (e.key === 'Escape' && showEmoji) { setShowEmoji(false); return }` as the **first** check in the global keydown handler (`Chat.jsx:509`), before all other Escape handling.

## FIX B — Works with the typing box

- **Keyboard offset var:** in the visualViewport `apply()` added `root.style.setProperty('--chat-kb-offset', \`${window.innerHeight - (vv ? vv.height : window.innerHeight)}px\`)` (`Chat.jsx:455`), cleaned up with `removeProperty` on unmount (`Chat.jsx:468`).
- **CSS:** `ep-wrap` `bottom` changed from `0` to `bottom: var(--chat-kb-offset, 0px)` (`chat-thread.css:2957`). When the keyboard opens (KB offset > 0) the picker lifts above it; otherwise stays pinned to the bottom.
- **Close on input focus:** added `onFocus={() => { if (showEmoji) setShowEmoji(false) }}` to the message `<textarea>` (`Chat.jsx:4044`) so tapping the input closes the picker and lets the keyboard take over.

## VERIFICATION

- `npx eslint src/pages/Chat.jsx` → 14 problems (10 errors, 4 warnings), **identical pre-existing baseline** (offer/offer DM/reaction/search `set-state-in-effect` + unused vars; line numbers only shifted by added lines). No new errors from this task.
- `npm run build` → `✓ built in 3.19s` (2105 modules). Passes.
- `ep-backdrop` → `Chat.jsx:3872` (JSX) + `chat-thread.css:2945` (CSS). ✓
- `chat-kb-offset` → `Chat.jsx:455,468` + `chat-thread.css:2957`. ✓
- `setShowEmoji(false)` sites incl. new: `Chat.jsx:509 (Escape), 513 (existing Escape), 574 (click-outside), 1061, 2989, 3872 (backdrop), 4022, 4032, 4044 (textarea focus)`.

## Notes
- `setShowEmoji(false)` on Escape is now handled twice (new first check `:509` + old `:513`) — harmless, the first returns early.
- `--chat-kb-offset` defaults to `0` when the picker isn't affected by keyboard (desktop / keyboard closed), so the picker stays pinned to the bottom of the screen.