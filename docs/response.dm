# Task: await applyLowDataIfConfigured() before offer/answer — DONE

Task source: `docs/claudehelp.md`. Applied the cheap fix for hypothesis #1.

## Change made

`src/hooks/useWebRTC.js`:

1. **`applyLowDataIfConfigured(pc, callType)` → `async function`**
   - `sender.setParameters(paramsBefore)` is now `await`ed inside a `try/catch`.
   - A rejection no longer vanishes into a fire-and-forget `.catch()`; it is caught, logged (`❌ setParameters FAILED`), and the function resolves `false`.
   - Non-video and High-quality paths resolve `true` (nothing to apply, not an error).
   - No video sender found → logs a warning and resolves `false`.
   - Success resolves `true`.

2. **Call sites now `await` it, so the cap is fully applied before SDP is created:**
   - `startCall` (`useWebRTC.js`): `await applyLowDataIfConfigured(pc, type)` — runs before `pc.createOffer()`.
   - `answerCall` (`useWebRTC.js`): `await applyLowDataIfConfigured(pc, type)` — runs before `pc.createAnswer()`.

## Verification

- `npm run build` — ✅ passes (Vite production build, 4.74s).
- `npx eslint src/hooks/useWebRTC.js` — no new errors from this change; the 14 reported errors are pre-existing (unused `ctxPlayRing`/`publishActiveCall`, empty `catch (_) {}` blocks) and untouched.

## Note for the Data Saver test

The function now waits on `setParameters` (and swallows `InvalidModificationError`/`InvalidStateError` into a `false` + log line) before the offer/answer is created. On the next Data Saver test call, watch:

- `[applyLowDataIfConfigured] ✅ setParameters SUCCESS` — should now appear **before** the offer is created.
- `[applyLowDataIfConfigured] ❌ setParameters FAILED` — if this shows, the rejection is now surfaced and will tell us the exact Chrome error (and the cap simply won't be applied, which is not a call-blocker).

If the Accept issue persists after this, proceed to the full 4-case reproduction matrix (Data Saver, Balanced, High, Standard) with both-side console captures as documented in the previous `docs/response.dm` entry.