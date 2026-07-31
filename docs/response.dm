# Task 7 — Prevent the SW notification path from stealing calls from GlobalCallListener (fix direction #1)

Status: DONE. Changes in `src/App.jsx` + `src/components/GlobalCallListener.jsx`. Budget/bitrate logic, `useWebRTC.js` chat behavior, and all UI copy untouched.

## Step 1 — Verified synchronous claim before any await (quoted real code)

`GlobalCallListener.jsx:360-382` (`answerWithOffer`):
```js
async function answerWithOffer(src) {
  if (!src?.offer || !src.fromUser || !src.callId) { ... return }
  stopRing()                 // :367 — sync
  stopRingtone()             // :368 — sync
  dismissIncoming()          // :369 — sync
  setConnecting(false)       // :370 — sync
  claimCallStack?.('global') // :371 — sync

  const type   = src.callType || 'voice'
  const callId = src.callId
  const callerId = src.fromUser
  const offer  = src.offer   // :373-376 — sync

  callIdRef.current = callId   // :378 — sync
  callerIdRef.current = callerId // :379 — sync
  offerRef.current = offer     // :380 — sync
  sessionStorage.setItem('__globalCallActive', callId) // :381 — sync
  sessionStorage.removeItem('__pendingCall')           // :382 — sync
  sessionStorage.removeItem('__pendingCallId')
  ...
  const stream = await navigator.mediaDevices.getUserMedia(...) // first await, :386
```
**No `await` appears between the function entry and the `getUserMedia` at :386.** `claimCallStack('global')` + the `__globalCallActive` write + the `__pendingCall` clears all happen synchronously in the same tick. Confirmed by reading, not assumption.

## Step 2 — App.jsx `onAnswer` guard (App.jsx:217-225)

```js
onAnswer: (fromUser, callId, chatId) => {
  stopRingtone()
  const globalActive = sessionStorage.getItem('__globalCallActive')
  if (globalActive && String(globalActive) === String(callId)) {
    return
  }
  ... window.location.href = url ...
}
```
If GlobalCallListener is already handling this call in-app, the SW `ANSWER_CALL` handler bails instead of hard-navigating and wiping the in-memory stack claim. `String()` coercion is defensive for number-vs-string callIds.

## Step 3 — Mount-time restore for `__globalCallActive` (GlobalCallListener.jsx:244-296)

New effect runs on mount:
- **Reclaimable** (`__globalCallActive` set + `__pendingCall` present with matching callId + real offer): synchronously re-claims `global`, consumes `__pendingCall`/`__pendingCallId` (so the chat stack's `restorePendingCall` — which only bails on `getCallStackOwner() === 'global'` — cannot steal it), starts the early-ICE buffer, and defers only the UI `setIncoming`/`setIncomingCall` via `setTimeout(0)` so the claim wins the effect race against `PersistentCallShell`'s restore effect (GlobalCallListener mounts before it at App level). The `setState` is deferred both for the race and to satisfy the `react-hooks/set-state-in-effect` lint rule.
- **Orphaned** (flag set but no matching pending offer): the WebRTC session can't be resurrected (PC/streams are gone), so the flag is cleared — it can never stick around and block future SW navigation.

## Step 4 — Reliable flag clearing in all teardown paths

`cleanupCall()` remains the single teardown and clears all three keys (`__globalCallActive`, `__pendingCall`, `__pendingCallId`) at :598-600 and `releaseCallStack('global')` at :619. Every teardown path routes through it or the manual cancel/decline branch (:149-152 which also clears all three):
- cancel/decline/hangup branch → cleanupCall
- ICE/connection `failed` → cleanupCall
- `handleDecline` → cleanupCall · `handleHangUp` → cleanupCall
- **new:** in-app answer failure → cleanupCall (see below)

## New failure-path handling (the edge case the reviewer asked about)

`handleAnswer` (GlobalCallListener.jsx:339-357) and the delayed-answer path (:218-231) now wrap `answerWithOffer` in try/catch. On failure after claiming:
1. `cleanupCall()` runs → closes the pc, stops media, **clears `__globalCallActive`** (so the SW navigation guard stops blocking), releases the stack.
2. The offer is **re-queued** to `__pendingCall`/`__pendingCallId` — so a fresh notification tap (or the chat stack, if the user lands on the chat page) can still answer as a fallback.

## Verification

- `npx eslint src/App.jsx src/components/GlobalCallListener.jsx`: GlobalCallListener back to exactly its 11 pre-existing issues (9 errors, 2 warnings) — my new set-state error + dep warning both removed. App.jsx: 3 pre-existing errors in untouched code (setSession-in-effect :129, fetchRole/setupPush hoisting :138-139); none from my `onAnswer` change.
- `npm run build` → passes (5.79s).

## Edge cases I'm not fully confident about

1. **Failed in-app answer → fallback requires re-navigation.** The re-queued `__pendingCall` only helps if the user then taps the notification again (or is on the caller's chat page). If neither happens, the call just dies after the failure — but that's strictly better than a zombie call + blocked flag.
2. **getUserMedia-denied path is NOT re-queued.** `answerWithOffer` returns early (`alert` + `handleDecline`) rather than throwing, so no fallback is offered — correct, since a chat restore would also be denied camera/mic.
3. **Orphaned mid-call reload.** If the app reloads *mid-call* (call already answered, `__pendingCall` consumed), the mount restore can't resurrect the pc — it clears the flag and the call is dropped. Unavoidable without a full call-state store; documented as the "can't resurrect" case.
4. **`__globalCallActive` set on a different call's reload.** If the flag points at a stale callId different from the new ring, the guard/restore both fall through to "orphaned" → flag cleared → SW navigation works normally for the new call.
5. **Native notification vs in-app UI race** (user taps both almost simultaneously): whichever claims `global` first wins; the guard + synchronous claim make the reload-steal path effectively unreachable now, but a true concurrent tap is inherently race-y.
