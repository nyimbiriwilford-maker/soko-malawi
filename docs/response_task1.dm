# Task 1 Fix Report — Correct Byte Summation (no other changes)

Status: DONE.

## The fix (`src/hooks/useCallDataBudget.js`, only file changed)

Old summation added transport **plus** inbound-rtp/outbound-rtp → media bytes counted ~2x.

New logic:
- **Transport only**: sum `bytesSent + bytesReceived` from `transport` reports when present.
- **Fallback only when no transport report exists** (older browser / edge case): sum `inbound-rtp` (`bytesReceived`) + `outbound-rtp` (`bytesSent`) **instead** of transport — never in addition.
- Same file, same public surface `{ bytesUsed, sampleUsage }`, same wiring in `useWebRTC.js`. No other changes.

```js
let transportFound = false
stats.forEach((report) => {
  if (report.type === 'transport') {
    transportFound = true
    sum += (report.bytesSent || 0) + (report.bytesReceived || 0)
  }
})
// Fallback: inbound-rtp + outbound-rtp INSTEAD of transport (not in addition).
if (!transportFound) {
  stats.forEach((report) => {
    if (report.type === 'inbound-rtp') {
      sum += report.bytesReceived || 0
    } else if (report.type === 'outbound-rtp') {
      sum += report.bytesSent || 0
    }
  })
}
```

## Verification

- `npx eslint src/hooks/useCallDataBudget.js` → clean.
- `npm run build` → passes (2096 modules, 3.25s).

Math sanity check (mocked `getStats()` shapes, exercising the exact summation loop):

```
voice w/ transport:    1200 (expect 1200, not the double-counted 2400)
video w/ transport:  123000 (expect 123000, not 239000)
no transport fallback:  1000 (inbound 600 + outbound 400, INSTEAD of transport)
no transport video:   120000 (inbound 80000 + outbound 40000)
```

`candidate-pair` reports are correctly ignored (not a transport/inbound/outbound type).

## Real console output — CANNOT be produced from this environment

I want to be straight about this: this is a headless CLI on the repo, with no browser, no `getUserMedia`, and no way to sign in two users and place real calls. I will not paste fabricated numbers — the "expected output" style block you rejected is exactly what I'm refusing to repeat.

To get the real log you need, run the app yourself and do:
1. Two logged-in tabs (user A, user B). Open devtools → Console in the tab that's IN a call (the timer lives in the chat stack — caller or callee, either works since both run `useWebRTC`).
2. Voice test: A calls B (voice), talk ~30s. Copy the `[CallDataBudget] bytesUsed:` lines.
3. Video test: A calls B (video), stay ~30s. Copy those lines too.
4. Look for: starts near 0 and climbs steadily (no jumps/resets mid-call), and video's per-second growth clearly above voice's.

Paste those logs here (or drop them into `docs/claudehelp.dm`) and I'll sanity-check the trend before Task 2.

One watch-out while you test: if `bytesUsed` ever shows a huge first-sample jump that then plateaus, that's the transport report also counting RTCP/candidate-pair traffic — let me know and I'll switch the meter to sum RTP-only deltas instead (we already have both code paths isolated).

## Blocking Task 2

Task 2 (wiring into `GlobalCallListener.jsx` + budget-selector UI) is ready to start once the corrected math is confirmed against a real log.
