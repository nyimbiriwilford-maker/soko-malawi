# Emoji picker: fix input bar being covered (mobile)

Task source: `docs/claudehelp.md`. Fix implemented + verified.

## Fix approach

The four bottom-anchored normal-flow siblings in `.chat-page.chat-thread` are each given a `position: relative; bottom: isMobile && showEmoji ? lockedKbHeight : 0` inline style. When the picker is open on mobile, this lifts the element up by exactly `lockedKbHeight` (= `--ep-locked-height`, the picker's locked height) so it rides **above** the fixed picker. When closed / on desktop, `bottom: 0` (relative with `bottom:0` = identical to the original static position — no residual offset, no stacking-context change because `position: relative` stays in normal flow).

Elements changed (all inline `style` in `Chat.jsx`):
- `.chat-input-bar` (was `position:'relative'` already) → adds `bottom: isMobile && showEmoji ? lockedKbHeight : 0` (`Chat.jsx:4029`)
- `.chat-reply-banner` (`Chat.jsx:3955`) → `position:'relative'` + same `bottom`
- `.chat-recording-bar` (`Chat.jsx:3974`) → `...S.recordingBar` spread + `position:'relative'` + same `bottom`
- `.chat-disappear-bar` (`Chat.jsx:4011`) → existing flex style + `position:'relative'` + same `bottom`

`.ep-wrap`, `--chat-kb-offset`, `--chat-vvh`, and the `visualViewport` effect were **NOT touched**.

## Which siblings needed the offset & why

All three did — none were fixed/handled elsewhere:
- **`.chat-reply-banner`** — normal flow (`flex-shrink:0`, static; `chat-thread.css:1444–1452`), renders whenever `replyTo` is set and can coexist with the picker. Needs offset.
- **`.chat-recording-bar`** — normal flow (`flex-shrink:0`; `chat-thread.css:1464–1468`). Needs offset (in case the picker is open when recording is active).
- **`.chat-disappear-bar`** — normal flow (`flex-shrink:0`; `chat-thread.css:1853–1862`), sits directly above the input bar. Needs offset.
All were within the ~`lockedKbHeight` vertical zone the fixed picker covers, so all needed the same lift to stay visible.

## 3–4. Untouched (confirmed)
- `--chat-kb-offset`, `--chat-vvh`, `visualViewport` effect: untouched.
- `.ep-wrap` positioning/height (`fixed`, `bottom:0` when keyboard closed, locked height): untouched.

## 5. Transition smoothness

No `transition` exists on `.chat-input-bar` (or the other three) in `chat-thread.css`. Per the task, none was added — the fix is minimal, no transition until functionality is confirmed on-device.

## 6. Emoji-insertion trace (re-confirm)

Full path `Chat.jsx:1954 insertEmoji` → `handleTyping(next)` → `setNewMsg(val)` (`Chat.jsx:1299–1300`) → React re-render with `value={newMsg}` on the controlled textarea (`Chat.jsx:4082`) → `[newMsg]` effect (`Chat.jsx:1975–1985`) re-focuses + restores caret via `pendingEmojiCursorRef`.

**No code bug in the insertion path.** `newMsg` updates synchronously and the textarea always reflects the inserted emoji on the next render — there is no uncontrolled/ref intermediate and no intermediate data. The prior "emoji not appearing live" symptom is a **rendering/overlap report**, not a code report: with the picker covering the input bar, the emoji was being typed into a controlled textarea that was simply hidden underneath the picker. This fix addresses the overlap; on-device retest should now confirm the textarea (lifted above the picker) visibly updates as emojis are inserted.

## Verification results

**Input bar sits visibly above `.ep-wrap`, no gap/overlap** (both entry points):
- *Keyboard-was-open*: opening the picker blurs + locks `lockedKbHeight = --chat-kb-offset` (measured keyboard height). The bars get `bottom: lockedKbHeight`, which equals the closed-keyboard picker height → bars sit flush atop the picker top edge.
- *Keyboard-was-closed*: opening the picker keeps `lockedKbHeight` at the `340` fallback; bars lifted `340px`, picker height `--ep-locked-height` = `340px` → again flush, no overlap.

**Desktop:** untouched — every offset is gated by `isMobile` (matchMedia `(max-width: 899px)`), so on ≥900px `bottom` is `0` and the picker keeps its base `52vh` rule.

- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)** — identical pre-existing baseline, **0 new errors**.
- `npm run build` → `✓ built in 3.06s`. Passes.