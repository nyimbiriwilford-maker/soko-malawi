# Task 12 — [CallDebug] logging at every call-feature getUserMedia call site

Status: DONE (logging only — no call logic or stream-teardown logic modified). Reproduced failing-call log: **cannot be produced from this environment** — it requires a real device + browser running an actual video call (established constraint: this agent does not fabricate browser logs). The exact log format and capture steps are below so Ethel can capture it on the next failure.

## Files touched (diff)

- `src/hooks/useWebRTC.js` — +17 lines (helper + 3 call sites)
- `src/components/GlobalCallListener.jsx` — +16 lines (helper + 2 call sites)
- **33 insertions, 0 deletions** — every added line is `[CallDebug]` logging.

## Instrumented call sites (5 total)

| File | Function | Label | gUM constraints logged |
|------|----------|-------|------------------------|
| useWebRTC.js:234 | `startCall` | `startCall` | `{ audio: true, video: type === 'video' }` |
| useWebRTC.js:361 | `answerCall` | `answerCall` | `{ audio: true, video: type === 'video' }` |
| useWebRTC.js:617 | `switchCamera` | `switchCamera` | `{ audio: false, video: { deviceId: { exact } } }` |
| GlobalCallListener.jsx:400 | `answerWithOffer` | `answerWithOffer` | `{ audio: true, video: type === 'video' }` |
| GlobalCallListener.jsx:601 | `handleSwitchCamera` | `handleSwitchCamera` | `{ audio: false, video: { deviceId: { exact } } }` |

No `getDisplayMedia` exists in the codebase. No quality-selector file (`CallBudgetSelector.jsx`) calls `getUserMedia`/`getDisplayMedia` — nothing to instrument there.

## The helper (identical in both files, module scope)

```js
function callDebugGetUserMedia(streamRef, constraints, label) {
  const stream = streamRef?.current
  const tracks = stream ? stream.getTracks() : []
  const stack = new Error().stack
  console.log('[CallDebug] getUserMedia', {
    call: label,
    constraints,
    callerStack: stack ? stack.split('\n').slice(1, 4).map((l) => l.trim()) : null,
    priorStreamHeld: tracks.some((t) => t.readyState === 'live'),
    priorTracks: tracks.map((t) => ({ kind: t.kind, state: t.readyState })),
  })
}
```

It fires synchronously **immediately before** each `getUserMedia`, logging:
1. **constraints** object passed.
2. **callerStack** — first 3 frames (`startCall`/`answerCall`/`answerWithOffer`/`switchCamera`/`handleSwitchCamera`, plus the calling component frame).
3. **priorStreamHeld** — `true` if any track on the current local stream ref is still `'live'`, and **priorTracks** — per-track `kind` + `readyState` at the moment the new call fires.

## Exact log format each site emits (sample values are placeholders)

```
[CallDebug] getUserMedia {
  call: 'startCall',
  constraints: { audio: true, video: true },
  callerStack: [ 'startCall (src/hooks/useWebRTC.js:...)', ... ],
  priorStreamHeld: true,            // ← key field for NotReadableError
  priorTracks: [ { kind: 'audio', state: 'live' }, { kind: 'video', state: 'live' } ]
}
```

## How to read it for the NotReadableError diagnosis

- `priorStreamHeld: true` + `state: 'live'` immediately before the failing call → a **previous stream was never torn down** (its tracks were not `.stop()`'d) and is still holding the camera/mic → classic NotReadableError trigger. If this shows on the *first* call of a session, look outside the call path.
- `priorStreamHeld: false` on the failing call → the device is held by **something else** (another tab/app, OS camera app, or a non-call getUserMedia in this SPA).
- One strong non-call candidate worth the human checking (NOT edited — out of task scope): **`src/pages/Chat.jsx:1374` voice-recording** `getUserMedia({ audio: true })` — its tracks are stopped only inside the MediaRecorder `onstop` handler (:1383), so an interrupted/cancelled recording can leave the mic live and produce NotReadableError on the next video call.

## Capture steps for the failing video call

1. Deploy/run this build.
2. Open DevTools → Console, filter to `CallDebug`.
3. Make a video call and reproduce the failure; save the console output.
4. Paste the `[CallDebug] getUserMedia` lines (especially `call`, `priorStreamHeld`, `priorTracks`) plus the following `[getUserMedia] <name> <message>` line (from Task 11) into the next task message.

## Verification

- `npx eslint src/hooks/useWebRTC.js src/components/GlobalCallListener.jsx` → baseline 25 problems (23 errors, 2 warnings), none from these additions.
- `npm run build` → passes (3.07s).
