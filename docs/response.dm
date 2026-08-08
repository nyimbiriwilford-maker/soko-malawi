# Task: fix duplicate answer signal + duration:0 usage records — DONE

Task source: `docs/claudehelp.md`. Both bugs from the Data Saver test fixed, built, lint-checked.

## Bug 1 — Duplicate "answer" signal (root cause + defensive fix)

**Root cause:** two receiver stacks can race to answer the same incoming call — the global stack (`GlobalCallListener.answerWithOffer`) on the Accept tap, and the chat restore stack (`useWebRTC.answerCall` via `restorePendingCall`) — and each sends its own `answer` broadcast on the receiver's device. The caller's `handleIncomingSignal` then sees `[CallContext] signal received: answer` twice; the second application of an answer to an already-stable connection throws `InvalidStateError: Called in wrong state: stable`.

**Fix A — exactly-once delivery (`CallContext.jsx`):**
- Added `answeredCallIdsRef` (Set of callIds already answered).
- `sendSignal()` now dedupes `_event === 'answer'`: the first answer for a callId is broadcast; any subsequent answer for the same callId is logged (`duplicate answer ignored`) and dropped. This kills the duplicate at the transmitter regardless of which stack wins the race.

**Fix B — caller defensive handling (`useWebRTC.js`):**
- The `answer` handler now warns-and-returns when `signalingState !== 'have-local-offer'` (duplicate / late answer).
- The `setRemoteDescription(...)` catch downgrades the specific "already stable / wrong state" rejection to a warning instead of a console error, so a stray duplicate can never break the UX or produce a scary error.

## Bug 2 — Every saved usage record has `duration: 0` (root cause + fix)

**Root cause:** `hangUp() → endCallLocally()` resets both `callDurationRef.current` and the React `callDuration` state to `0` in the same render that sets `callState = 'idle'`. `PersistentCallShell` built its summary (`{ duration: callDuration, ... }`) from that just-zeroed React state at the exact moment it detected the idle transition, so every `saveCallUsageRecord(...)` row was captured with `duration: 0`. Note `hangUp()` captured the correct `dur` into the chat-message path — only the saved-record path read the zeroed value.

**Fix (`useWebRTC.js` + `PersistentCallShell.jsx`):**
- Added `lastFinishedDurationRef`, populated inside `endCallLocally()` with the final `callDurationRef.current` **before** it is zeroed (also covers ICE-failure / connection-failure ends, not just user hang-up).
- Exposed via `getLastCallDuration()` on the hook return.
- `PersistentCallShell` builds the summary with `duration: getLastCallDuration() || callDuration`.

## Verification

- `npm run build` — ✅ passes (Vite production build clean).
- `npx eslint` on the three modified files — **no new errors introduced**; all 86 reported findings are pre-existing (ref-during-render patterns on `stickyRef`/`budgetCappedRef`, unused `_` catch vars, empty blocks) and untouched.

## What to check on the next test call

1. Caller console: `[CallContext] signal received: answer` appears **once**; no `InvalidStateError`; connection goes `in-call`.
2. Receiver console: `[CallContext] duplicate answer ignored for callId:` should NOT appear (that log only fires if a second answer is still attempted).
3. `[PersistentCallShell] SAVING usage record` now logs a **non-zero `duration`** (seconds), and `getLearnedRates()` thereafter reports valid records (≥2 samples, ≥60s).

## Not changed in this pass

- Debug `console.log` cleanup across `callBudgetPrefs.js`, `useWebRTC.js`, `GlobalCallListener.jsx`, `useCallDataBudget.js`, `CallDataMeter.jsx`, `PersistentCallShell.jsx`, `CallContext.jsx`, `FloatingIncomingCall.jsx` — deferred to the agreed cleanup pass before the Vercel push, alongside the decision on the per-(callType, quality) learned-rate split.