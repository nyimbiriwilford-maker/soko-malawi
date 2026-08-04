# Call Data Budget — Progress and Architecture

## 1. Objective

The Call Data Budget feature gives a Soko user control over how much data their calls consume. It does exactly two things: it **measures** the data used during WebRTC calls, and it **caps** video quality to a low-data rate when the user has chosen a budget that calls for it.

It deliberately does **not** do anything else. It never reads carrier bundle balances — it has no idea what mobile plan the user is on, what their remaining data is, or what other apps consume. It only measures Soko's own traffic on its own peer connections and lets the user opt into a cap.

Concretely, the feature covers:
- Measuring bytes sent and received per call (`useCallDataBudget`).
- A shared low-data video bitrate cap (`callBitrateCap`).
- Budget presets, persistence, and duration estimation (`callBudgetPrefs`).
- A pre-call budget selector UI.
- Wiring all of the above into both call stacks.

## 2. Architecture context

Soko runs **two parallel WebRTC call stacks**, and any call-related feature must be wired into **both** — this is the single most important constraint of the codebase:

1. **Chat stack** — `src/hooks/useWebRTC.js`. A hook mounted at App level via `PersistentCallShell.jsx`, used for calls initiated from a chat thread (`startCall`) and answered in-app on a chat screen (`answerCall`). The in-call UI is `ChatCallHost.jsx`. This is the stack the chat product surface is built around.
2. **Global stack** — `src/components/GlobalCallListener.jsx`. An App-level component that handles incoming calls regardless of which screen the user is on. It answers via `answerWithOffer` and runs its own `RTCPeerConnection`. It exists so a call can be answered even when the user is not inside the chat thread.

Because an incoming call can be claimed by either stack depending on navigation state, both stacks must independently apply (and tear down) any call-data behavior.

**Signaling** flows over Supabase Realtime. Each user subscribes to a per-user channel `call_inbox_${userId}` (`CallContext.jsx`) on which offers, answers, and hangups are broadcast. ICE candidates go through a separate `ice_candidates` table (`CallContext.jsx`), with early-candidate buffering for candidates that arrive before the peer connection exists; candidates for a finished call are deleted on cleanup. This split (Realtime for signaling messages, the table for candidates) is the existing pattern and is not something the budget feature modifies.

## 3. What's built, file by file

### `src/hooks/useCallDataBudget.js` — measurement

A read-only usage meter. It does **not** run its own timer; it exposes `sampleUsage()` which the caller wires into its existing call timer, plus `bytesUsed` state.

- Calls `pc.getStats()` and sums only the **transport** report's `bytesSent + bytesReceived`, which already includes media plus RTCP traffic.
- Falls back to summing `inbound-rtp`/`outbound-rtp` **instead of** the transport report (for older browsers) — never in addition, which would double-count media bytes.
- **Resets on new call:** it compares the current `RTCPeerConnection` instance against the last one it sampled; a new instance means a new call, so the running total is zeroed.

**Cumulative-counter bug (found and fixed):** the running total was originally built up with `+=` on every poll. Because transport and RTP stats are cumulative since the connection started, accumulating them repeatedly compounded the total (quadratic growth). The fix is to **assign** the fresh cumulative sum each poll (`runningTotalRef.current = sum`), never increment.

**Validated measured rates (uncapped, real calls):** voice runs at roughly **10–11 KB/s**; video at roughly **250–280 KB/s**. These measurements are the empirical basis for the budget estimates (see `callBudgetPrefs`).

### `src/lib/callBitrateCap.js` — the shared cap

The module every stack uses to actually reduce video data.

- `applyMaxBitrateToVideoSender(pc, maxBitrate = 40000)` — finds the outgoing video sender, reads its `sender.getParameters()`, sets `maxBitrate` on every encoding (creating an encodings array if none exists), and applies via `setParameters`. Failures are caught, logged, and reported as `false`.
- `startLowDataCap(pc, type)` — reads the stored budget pref; returns `null` (a clean no-op) unless the call should auto-reduce quality (video with a low or medium preset). When it applies, it caps immediately and then **re-applies every 5 seconds** via `setInterval`, returning the interval id.
- `stopLowDataCap(intervalId)` — clears that interval.

**The units lesson:** `RTCRtpEncodingParameters.maxBitrate` is in **bits per second**, not bytes. The 40000 default is therefore 40 kbit/s.

**Soft-ceiling drift finding:** browsers drift away from a one-time cap, so the cap must be re-applied on an interval rather than set once. That interval must live in a ref so teardown can always clear it.

**Validated capped rate:** the 40 kbit/s cap produces roughly **25–30 KB/s** of real traffic — about a 5× overshoot of the nominal cap. This measured outcome (not the nominal figure) is what `RATES.video.lowData` records.

### `src/lib/callBudgetPrefs.js` — presets, storage, estimation

Pure logic with no UI and no call-behavior side effects.

- `BUDGET_PRESETS` — `video: { low: 10, medium: 30, high: 75 }` MB, `voice: { low: 5, medium: 15, high: 40 }` MB.
- `getCallBudgetPref(callType)` — reads `soko_call_budget_${callType}` from `localStorage` and validates its shape (preset must be one of `low|medium|high|custom`, `mb` must be a number); returns `null` for missing or malformed values.
- `setCallBudgetPref(callType, pref)` — persists the choice.
- `estimateDuration(callType, mb, lowDataMode)` — `(mb * 1024 * 1024) / RATES[callType][rate]`, projecting how long a call can run before hitting its budget.
- `RATES` — `video: { normal: 265000, lowData: 28000 }`, `voice: { normal: 10500, lowData: 10500 }` bytes/sec. The voice lowData rate intentionally equals the normal rate (see section 8).
- `shouldAutoLowData(callType, preset)` — `true` only for **video** with preset **low or medium**; voice and high are never auto-capped.

### Wiring into both call-start paths

- **Chat stack (`useWebRTC.js`):** both `startCall` and `answerCall` call `applyLowDataIfConfigured(pc, type)` right after the connection is up. That helper (`:644`) stops any previous cap interval, then starts a fresh one. `endCallLocally` (`:496`) stops the interval.
- **Global stack (`GlobalCallListener.jsx`):** `answerWithOffer` stops any previous interval and starts one after tracks are attached (`:467-468`); the teardown path stops it (`:618`).

**No-op guarantee:** with no pref set, `startLowDataCap` returns `null` and the call behaves exactly as before. The feature only changes behavior once a user actively opts into a low or medium video budget.

## 4. Major bug found and fixed: the SW-notification hard-reload stack-stealing race

This was the bug that made the global stack effectively unreachable on real phones (Tasks 6–7).

**Root cause.** Answering a call from an OS push notification triggers a full hard reload of the app: the notification click posts `ANSWER_CALL`, and `App.jsx`'s `onAnswer` navigates via `window.location.href`. That reload wipes `GlobalCallListener`'s in-memory claim on the call — but the pending-call offer survives in `sessionStorage.__pendingCall`. When the app remounts, the chat stack's `restorePendingCall` (`useWebRTC.js:649`, invoked from `PersistentCallShell.jsx:110`) sees the surviving offer and claims the call as `owner=chat`. Meanwhile `__globalCallActive` was being written but **never read**, so the global stack's claim was invisible to the rest of the app. Net result: on real phones, `owner=chat` always won over `owner=global`, no matter which stack should have handled the call.

**The fix.**
- **Synchronous claim.** `GlobalCallListener` writes `__globalCallActive` synchronously before any `await` in the answer path, so the claim is durable before anything can navigate.
- **App-level navigation guard.** `App.jsx`'s `onAnswer` (`:217-225`) now bails out when `__globalCallActive` matches the notification's call id, so the hard reload never happens for a call the global stack already owns.
- **Mount-time restore.** On remount (`GlobalCallListener.jsx:244-296`), if `__globalCallActive` still points at an incoming pending call, the component synchronously reclaims the global stack, consumes `__pendingCall`, defers UI state to `setTimeout(0)`, and clears orphaned flags.
- **Failure-path re-queueing.** If answering fails — in `handleAnswer` or in the delayed-answer path — the component runs `cleanupCall()` and then re-writes `__pendingCall`, so the chat stack or a later notification tap can still take over the call.

**Verification.** The fix was verified by tracing the full answer flow through the code, reviewing the edge cases (reload mid-answer, crash/HMR remount, answer failure), and confirming a clean lint and build. A live end-to-end confirmation of `owner=global` on a real device was the intended next step but was blocked until real pre-call UI existed (section 6); the selector now unblocks that test.

## 5. Known pre-existing bugs (not part of this feature)

Flagged as separate tickets, intentionally **not** fixed here:

1. **Recurring `403 Forbidden` on `users?on_conflict=id`** — a permissions/upsert problem on the users table seen during call setup.
2. **Occasional duplicate hangup signals** — hangup events sometimes process twice.
3. **Hardcoded TURN credentials in `src/lib/webrtc.js`** (`:24-31`) — a committed fallback TURN username/credential baked into the bundle. Env overrides exist (`VITE_TURN_URLS` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`), but the fallback is static. TURN credentials should ideally be short-lived and server-issued.
4. **Two duplicate Vercel projects both deploying from `master`** — a deployment-config risk of split or conflicting deploys.

## 6. The testing blocker, and its resolution

For a long time the feature was effectively untestable on real devices: `setCallBudgetPref` was reachable only through a **dev-only console hook** — `window.setCallBudgetPref = setCallBudgetPref` gated behind `import.meta.env.DEV` (`useWebRTC.js:11-12`) — which is stripped from production builds. Every real-device test required DevTools access to a dev build, which repeatedly blocked end-to-end verification.

**This is now resolved by a real pre-call UI.** `src/components/CallBudgetSelector.jsx` (Task 8) shows Low / Medium / High presets before an outgoing call starts; it is gated into the chat-stack call buttons (`CallHeaderButtons` in `ChatCallHost.jsx`). The selector pre-selects the saved preference (defaulting to medium), shows the estimated call duration for each preset, and persists the choice. Real-device testing of the chat stack's outgoing path no longer depends on console access.

## 7. Validated vs. not yet validated

- **Chat-stack capping: fully validated end-to-end on a real call.** With a low or medium video budget set, a real video call was capped at the expected **~25–30 KB/s**, matching `RATES.video.lowData`. The uncapped measurement baseline (voice ~10–11 KB/s, video ~250–280 KB/s) was also confirmed.
- **Global-stack capping: wired and the path is reachable, but not yet empirically confirmed.** The cap wiring is present in `answerWithOffer` and its teardown, and the code path is reachable via the global answer flow. However, the actual capped rate on the global stack has not yet been measured on a real call: the earlier real-device sessions were blocked by the dev-only hook, and before the Task 6/7 fix `owner=global` was never achieved at all (the chat stack always won). Re-confirming `owner=global` post-fix and measuring the capped rate on the global stack is the outstanding empirical check.

## 8. Not yet built

- **In-call live data meter** — the second half of the Phase 4 real UI. `useCallDataBudget` already produces a live `bytesUsed`, but no in-call UI displays it yet.
- **Phase 5 enforcement behavior** — the 80% budget toast warning, and at 100% a countdown with **End Call / Add 10MB** options. Not built.
- **Voice low-data mode** — `RATES.voice.lowData` exists but equals the normal rate, and no bitrate cap is applied for voice calls. Deprioritized; video is the data-heavy surface.
- **Selector coverage** — the pre-call selector currently gates the chat stack's outgoing call path; it has not been extended to other entry points, and there is still no in-call meter or any enforcement UI.

*Documentation reflects the state as of the Task 13 write-up (docs-only change; no code was modified).*
