# Task 5 — Post-refactor verification of the chat-stack cap path

Status: All 4 checks verified line-by-line against current source. The chat-stack cap path is intact post-extraction.

## 1. `applyLowDataIfConfigured` still calls `startLowDataCap`, which applies the cap immediately

Yes — both true, verified in source.

`src/lib/callBitrateCap.js:35-42` (exact current code):
```js
export function startLowDataCap(pc, type) {
  const pref = getCallBudgetPref(type === 'video' ? 'video' : 'voice')
  if (!pref || !shouldAutoLowData(type, pref.preset)) return null
  applyMaxBitrateToVideoSender(pc)          // <-- immediate, before the interval
  return setInterval(() => {
    applyMaxBitrateToVideoSender(pc)
  }, 5000)
}
```
The immediate call is line 38, before the `setInterval`. Not deferred to the first tick.

`src/hooks/useWebRTC.js:617-620` (exact current code of the wrapper):
```js
function applyLowDataIfConfigured(pc, type) {
  stopLowDataCap(lowDataIntervalRef.current)
  lowDataIntervalRef.current = startLowDataCap(pc, type)
}
```

## 2. Interval is exactly 5000ms

`callBitrateCap.js:39-41` — `setInterval(..., 5000)`. Confirmed, not a larger value post-refactor.

## 3. `lowDataIntervalRef` is not reset/cleared before it should be

- Declared once: `useWebRTC.js:69` `const lowDataIntervalRef = useRef(null)`.
- Written only in `applyLowDataIfConfigured` (`:619`).
- Cleared only in teardown: `useWebRTC.js:470-471` inside `endCallLocally()`:
  ```js
  stopLowDataCap(lowDataIntervalRef.current)
  lowDataIntervalRef.current = null
  ```
- `applyLowDataIfConfigured` is called **exactly once per call** — no repeated invocations that could stop-then-restart at the wrong time:
  - `:242-244` caller path (inside `startCall(type)`): `const pc = buildPeerConnection('caller')` → `stream.getTracks().forEach(t => pc.addTrack(t, stream))` → `applyLowDataIfConfigured(pc, type)`.
  - `:366-371` callee path (inside `answerCall()`): `const pc = buildPeerConnection('callee')` → `addTrack` loop → `applyLowDataIfConfigured(pc, type)`.
  - `buildPeerConnection` itself is invoked only those two places (defined `:156`), so there is no hidden re-negotiation path re-entering the cap logic.

## 4. Exact current code — call sites (for direct review)

Caller, `startCall()`:
```js
242   const pc = buildPeerConnection('caller')
243   stream.getTracks().forEach((t) => pc.addTrack(t, stream))
244   applyLowDataIfConfigured(pc, type)
```

Callee, `answerCall()`:
```js
366   const pc = buildPeerConnection('callee')
368   await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))
370   stream.getTracks().forEach((t) => pc.addTrack(t, stream))
371   applyLowDataIfConfigured(pc, type)
```

Cap application, `callBitrateCap.js:10-26`:
```js
export async function applyMaxBitrateToVideoSender(pc, maxBitrate = 40000) {
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
  if (!sender) return false
  try {
    const params = sender.getParameters()
    if (params.encodings?.length) {
      params.encodings = params.encodings.map((enc) => ({ ...enc, maxBitrate }))
    } else {
      params.encodings = [{ maxBitrate }]
    }
    await sender.setParameters(params)
    return true
  } catch (e) {
    console.warn('[CallDataBudget] setParameters failed:', e.message)
    return false
  }
}
```

## Notes relevant to the elevated deltas (~70-75 / ~40-45 KB/s)

The code path is intact, so the elevation is likely not a wiring regression. Two non-wiring factors worth checking before changing code:

1. **Timing vs. negotiation.** On both paths the cap is applied right after `addTrack`, before `createOffer`/`setLocalDescription`. Some browsers reset encoding params during negotiation; the 5s re-apply self-heals, so the flat band should appear within the first interval tick. If the manual test sampled only the very first seconds (or a short call), deltas measured in that window would read high.
2. **`startLowDataCap` failure → silent fallthrough.** If `setParameters` throws on the immediate call (pre-negotiation `InvalidStateError` is browser-dependent), the code warns once (`callBitrateCap.js:23`) and the interval keeps retrying every 5s. Elevated readings across the whole call would only persist if every retry failed — worth checking the browser console for repeated `[CallDataBudget] setParameters failed:` lines rather than inferring from `bytesUsed` alone.

No code changes made — this task was verify-and-report only.
