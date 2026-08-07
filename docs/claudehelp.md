Fix .attach-menu Clipping (Side-Effect)

Problem: overflow: hidden on .chat-input-bar clips the .attach-menu pop-up (which renders above the bar via position: absolute; bottom: calc(100% + 10px)). Must fix before shipping.

Task 1 — Remove overflow: hidden from the bar

The send button overflow is already fixed by min-width: 0 on .chat-composer and width: 100% / box-sizing: border-box. overflow: hidden is redundant and harmful. Remove it:

css
/* BEFORE */
.chat-thread .chat-input-bar {
  background: rgba(255,255,255,0.96) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--chat-line) !important;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
  gap: 6px !important;
  align-items: flex-end !important;
  width: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}

/* AFTER */
.chat-thread .chat-input-bar {
  background: rgba(255,255,255,0.96) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--chat-line) !important;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
  gap: 6px !important;
  align-items: flex-end !important;
  width: 100% !important;
  box-sizing: border-box !important;
}
Task 2 — Verify .attach-menu renders correctly

Confirm .attach-menu (chat-thread.css:1320–1337) still has:

css
position: absolute;
bottom: calc(100% + 10px);
z-index: 220;

No changes needed — just confirm these are intact after Task 1.

Task 3 — Verify send button is still contained

After removing overflow: hidden, confirm the fix still holds via the two properties that actually do the work:

.chat-input-bar has width: 100% !important and box-sizing: border-box !important ✓
.chat-composer has flex: 1 and min-width: 0 ✓

These two together are sufficient. overflow: hidden was never needed.

Deliverable

Report back with:

Confirm overflow: hidden removed
Confirm .attach-menu absolute positioning intact
Build passes