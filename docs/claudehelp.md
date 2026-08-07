Fix the emoji picker covering the input bar on mobile. Reference: docs/response.md investigation (confirmed: .ep-wrap is position:fixed and reserves no space, so .chat-input-bar — normal flow, last child — ends up underneath it).

1. In Chat.jsx, on .chat-input-bar's inline style (Chat.jsx:4029, currently position:'relative'), add a mobile-only bottom offset when the picker is open:
   - When isMobile && showEmoji: add `bottom: lockedKbHeight` (px, matching --ep-locked-height) via inline style, e.g. style={{...S.inputBar, position:'relative', bottom: isMobile && showEmoji ? lockedKbHeight : 0}}
   - Do NOT change position:'relative' to 'fixed' — keep it in normal flow, just shift it up with `bottom` (relative positioning respects bottom offset without leaving flow, avoiding new stacking-context surprises).
   - When showEmoji is false or not mobile, bottom must be 0 (or omitted) — confirm this returns to the exact original position with no residual offset.

2. Check whether reply banner (Chat.jsx:3943), recording bar (Chat.jsx:3958), and .chat-disappear-bar (Chat.jsx:4011) — all siblings between the picker and the input bar in source order — also need the same bottom offset when visible at the same time as the picker, so they don't get covered either. Apply the same isMobile && showEmoji ? lockedKbHeight : 0 pattern to whichever of these are normal-flow and positioned at the bottom (skip any that are already fixed/handled elsewhere).

3. Do NOT touch --chat-kb-offset, --chat-vvh, or the visualViewport effect — those are correct as-is per the investigation.

4. Do NOT touch .ep-wrap positioning/height (already correct: fixed, bottom:0 when keyboard closed, height locked).

5. Confirm transition smoothness is not required to change — no new CSS transition needed unless one already exists on .chat-input-bar; if one already exists, it's fine, if not, don't add one (keep this fix minimal, we can add animation polish separately once functionality is confirmed).

6. Manually trace through the emoji-insertion path (Chat.jsx: insertEmoji, [newMsg] effect) one more time and confirm in docs/response.md whether you see any reason the emoji might not appear live in the textarea as investigated — if truly no bug, state that explicitly so we know this was a rendering/visual report, not a code report, and can retest on-device.

After implementing, write to docs/response.md:
- Confirm .chat-input-bar sits visibly above .ep-wrap with no gap and no overlap, at both keyboard-was-open and keyboard-was-closed entry points
- Confirm which of reply-banner/recording-bar/disappear-bar needed the offset and which didn't (with reasoning)
- Confirm desktop is untouched (isMobile gate)
- Run npx eslint and npm run build, report results