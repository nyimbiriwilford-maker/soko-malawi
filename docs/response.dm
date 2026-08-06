# Permanent fixes: notification auto-dismiss + incoming call popup reappearing

Task source: `docs/claudehelp.md`. Root causes identified first, then permanent fixes. Files changed:
- `src/components/NotificationToast.jsx`
- `src/components/GlobalCallListener.jsx`

No other files changed.

---

## Bug 1 — Notification popup never auto-dismisses

### Root cause
`src/components/NotificationToast.jsx` (old lines 178-191) started the 6s auto-dismiss timer **inside the queue-pump effect**, and that effect returned a cleanup of `() => clearTimeout(timerRef.current)` with deps `[queue, visible]`.

Sequence:
1. Render: `queue=[N]`, `visible=null`. Effect runs → `setQueue([])`, `setVisible(N)`, `setShow(true)`, and starts `timerRef = T1 (6s)`. Returns cleanup C1.
2. Those state writes re-render with `queue=[]`, `visible=N`. React then runs C1 → **`clearTimeout(T1)`** — the just-created timer is destroyed.
3. The effect re-runs → early-returns (`visible` set) → no timer is ever restarted.

Result: the toast mounts but its auto-dismiss timer is always cleared one tick later, so it stays on screen indefinitely. (Not caused by StrictMode/duplicate listeners — the component is mounted once at `App.jsx:309`, the channel is guarded by `channelRef`, and the `sw-incoming-call`/realtime paths were verified clean. It was purely the self-clearing timer.)

### Fix (permanent)
Split timer ownership from the pump effect:
- Pump effect now only advances the queue (`setQueue`/`setVisible`/`setShow`) — it starts no timer and returns no cleanup.
- New dedicated effect keyed **only on `[visible, dismiss]`** starts the 6s timer when a toast becomes visible and clears it when `visible` changes/unmounts. Queue changes can no longer clear the active toast's timer.

Behavior now: each notification appears once → auto-dismisses after 6s → removed from state → next queued notification shows with its own fresh timer. Mouse-hover pause, quick-reply input pause, and send-success dismissal (`clearTimer`/`startTimer`/`handleSendReply`) still work because they share `timerRef`.

## Bug 2 — Incoming call popup reappears right after answering

### Root cause
There was no "answered/active call = single source of truth" guard. After the user tapped Answer, several paths could re-surface the incoming popup (via `setIncomingCall`/`setIncoming`/`playRing`), so the call would start correctly yet the ring UI popped again:

1. `GlobalCallListener` ring handler unconditionally called `setIncomingCall(payload)` and `playRing()` for any `ring` event — including a ring that arrived for a call the user had already committed to answering (realtime re-delivery, or the realtime ring arriving after a push-only answer tap). The old "user already tapped answer" block then re-answered with `setTimeout(0)`, producing a popup flash or a lingering ring.
2. `armOfferRecovery` (push-only recovery) called `setIncomingCall(src)` **before** auto-answering when the user had already tapped Answer → popup flashed back.
3. The SW `sw-incoming-call` handler re-armed ring/recovery for a call that was already answered/active.

Verified: single mount (`App.jsx:307-310`), single broadcast channel (`CallContext.setupChannel` guarded by `channelRef`), single ring listener (useWebRTC defers with `return false`), and the App.jsx SW `INCOMING_CALL` 35s dedupe all work — the leak was these unguarded `setIncomingCall` re-surfaces.

### Fix (permanent)
Added a commit-state flag `answerCommittedRef` (set in `handleAnswer`, cleared in `cleanupCall`, the remote cancel/hangup path, and `answerWithOffer`'s early guard) and used it everywhere as the gate:

- **Ring handler** (`payload._event === 'ring'`): if `callStateRef === 'in-call'` → return `true` (fully ignore). If `answerCommittedRef` → never re-show the popup or re-ring; if this ring carries the awaited SDP offer (`answerWhenReadyRef && payload.offer`) the committed answer is **completed directly** (`answerWithOffer`) without any popup; otherwise the ring is swallowed.
- **`handleSwIncoming`**: bails immediately when in-call or committed — duplicate SW events can no longer re-arm ring/recovery.
- **`armOfferRecovery`**: when auto-answering (`answerWhenReadyRef`), skips `setIncomingCall` entirely (no popup flash); the popup is only surfaced when the user has not yet answered.
- **`handleAnswer`**: sets `answerCommittedRef = true` before branching (both offer-present and offer-missing paths).

Because the flag survives the getUserMedia await and the "waiting for offer" window, no code path can re-surface the incoming UI between tap-answer and connected, and the active call is the single source of truth until `cleanupCall()` resets everything.

---

## Verification
- `npx eslint src/components/GlobalCallListener.jsx src/components/NotificationToast.jsx`
  - GlobalCallListener: **11 problems (9 errors, 2 warnings)** — all pre-existing baseline (unused vars `handleDismiss`, `openCallerChat`, `toggleMute`, `_`/`no-empty` catches, 2 `exhaustive-deps`). No new issues from these edits.
  - NotificationToast: **2 problems (2 errors)** — pre-existing (`no-empty` catch; the pump effect's `set-state-in-effect`, which was already flagged at old line 181).
- `npm run build` → **passes** (`✓ built in 3.49s`).

## Files modified
| File | Change |
| --- | --- |
| `src/components/NotificationToast.jsx` | Split auto-dismiss timer into a `[visible]`-keyed effect; pump effect no longer owns/clears the timer |
| `src/components/GlobalCallListener.jsx` | Added `answerCommittedRef`; gated ring handler, `handleSwIncoming`, `armOfferRecovery`, `handleAnswer`, `cleanupCall`, remote-cancel, and `answerWithOffer` guard |

## Why these fixes are permanent
- The notification timer is now owned by an effect whose only dependency is the visible toast itself — nothing else can cancel it, and cleanup is automatic on replace/unmount.
- The call incoming state is now suppressed by an explicit answered/active state machine gate that spans the entire answer lifecycle (tap → offer wait → getUserMedia → connected → teardown), so duplicates/races/re-deliveries can no longer resurrect the ring popup regardless of ordering.