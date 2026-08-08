# Quality Picker Testing Script — Manual Validation

## Prerequisites

- Two devices/browsers for testing calls (or use two browser profiles)
- Chrome/Edge (for `chrome://webrtc-internals`) or Firefox (for `about:webrtc`)
- App running locally: `npm run dev`
- Two test accounts signed in

---

## Test 1: Data Saver — 40 kbit/s Ceiling

### Setup
1. Open the app in Browser 1 (primary test device)
2. Log in to test account A
3. Navigate to Settings or Call Budget configuration page
4. Select **Data Saver** quality (40 kbit/s label should be visible)
5. Set a budget preset (e.g., Medium or Custom 50 MB)
6. Save and return to main app

### Start Call
7. In Browser 2, log in as test account B
8. In Browser 1, initiate a **video call** to account B
9. In Browser 2, answer the call
10. Wait for call to stabilize (~5-10 seconds)

### Measure Bitrate — Browser 1
11. Open a new tab in Browser 1 → navigate to `chrome://webrtc-internals`
12. Find the active peer connection (should be at the top, with RTCPeerConnection stats)
13. Expand the connection → find the **Outbound-RTP (video)** section
14. Look for one of these fields (varies by browser):
    - `googTargetEncodebitrate` (Chrome/Edge)
    - `targetBitrate` (Firefox)
    - `bytesSent` graph → calculate rate from slope
15. **Record the bitrate value** — should be ≤40 kbit/s (40,000 bits/sec)
16. Let the call run for **2-3 minutes** — check the bitrate remains stable at ~40 kbit/s
17. Take a screenshot of the WebRTC stats showing the video bitrate

### Expected Result
- ✅ Bitrate stays at or below ~40 kbit/s for the entire call
- ✅ No jumps to 200 kbit/s or higher
- ✅ Call quality is noticeably lower (pixelated, lower frame rate)

### Record
- **Measured bitrate:** __________ kbit/s
- **Test result:** PASS / FAIL
- **Screenshot saved:** YES / NO
- **Console errors:** (list any, or write NONE)

---

## Test 2: Balanced — 200 kbit/s Ceiling

### Setup
1. In Browser 1, end the previous call
2. Navigate back to Call Budget settings
3. Select **Balanced** quality (200 kbit/s label)
4. Save and return

### Start Call
5. Initiate a new video call to account B
6. Answer in Browser 2
7. Wait for stabilization

### Measure Bitrate — Browser 1
8. Refresh `chrome://webrtc-internals` tab (or reopen it)
9. Find the new active connection
10. Locate the **Outbound-RTP (video)** section
11. **Record the bitrate value** — should be ≤200 kbit/s (200,000 bits/sec)
12. Let the call run for 2-3 minutes
13. Check bitrate remains at ~200 kbit/s or lower
14. Take a screenshot

### Expected Result
- ✅ Bitrate stays at or below ~200 kbit/s
- ✅ Higher quality than Data Saver (clearer video, smoother motion)
- ✅ No console errors

### Record
- **Measured bitrate:** __________ kbit/s
- **Test result:** PASS / FAIL
- **Screenshot saved:** YES / NO
- **Console errors:** (list any, or write NONE)

---

## Test 3: High Quality — Uncapped + Adaptive Steps

### Setup
1. End the previous call
2. Navigate to Call Budget settings
3. Select **High Quality** ("no cap" label)
4. Set a **low budget** (e.g., Custom 5 MB) to trigger adaptive stepping quickly
5. Save and return

### Start Call
6. Initiate a new video call to account B
7. Answer in Browser 2

### Measure Bitrate — Initial (100% Budget)
8. Refresh `chrome://webrtc-internals`
9. Find the Outbound-RTP (video) section
10. **Record initial bitrate** — should be uncapped (likely 500-2000+ kbit/s depending on network)
11. Take a screenshot showing high bitrate at call start

### Wait for Adaptive Steps
12. Let the call run and consume budget
13. Watch the bitrate in webrtc-internals as budget depletes
14. Expected adaptive steps (triggered by budget thresholds):
    - 50%-100% remaining: uncapped (normal)
    - 25%-50% remaining: drops to ~200 kbit/s
    - 10%-25% remaining: drops to ~80 kbit/s
    - <10% remaining: drops to ~40 kbit/s

### Measure Each Step
15. When bitrate drops (you'll see it in the graph), **record the new value**
16. Continue until budget is nearly exhausted or all steps have triggered
17. Take screenshots of each adaptive step

### Expected Result
- ✅ Initial bitrate is high (uncapped)
- ✅ Bitrate steps down as budget depletes: 200k → 80k → 40k
- ✅ Each step holds steady until next threshold
- ✅ No interference from quality picker — adaptive works as before

### Record
- **Initial bitrate (100% budget):** __________ kbit/s
- **After 1st step (~40% budget):** __________ kbit/s (expected ~200)
- **After 2nd step (~15% budget):** __________ kbit/s (expected ~80)
- **After 3rd step (<10% budget):** __________ kbit/s (expected ~40)
- **Test result:** PASS / FAIL
- **Screenshots saved:** YES / NO
- **Console errors:** (list any, or write NONE)

---

## Test 4: Edge Case — Data Saver + Full Budget

### Purpose
Verify that Data Saver ceiling is enforced even when adaptive would allow full quality.

### Setup
1. End previous call
2. Navigate to Call Budget settings
3. Select **Data Saver** (40 kbit/s)
4. Set a **high budget** (e.g., Custom 100 MB or Premium preset)
5. Save and return

### Start Call
6. Initiate a new video call to account B
7. Answer in Browser 2

### Measure Bitrate — Full Budget
8. Refresh `chrome://webrtc-internals`
9. Check the bitrate immediately after call starts
10. **Record the bitrate** — should be ~40 kbit/s, NOT uncapped
11. Let call run for 2-3 minutes with budget staying at ~100%
12. Confirm bitrate remains at ~40 kbit/s the entire time

### Expected Result
- ✅ Even with 100% budget remaining, bitrate is capped at 40 kbit/s
- ✅ Adaptive system does NOT override the user's Data Saver choice
- ✅ This proves the ceiling logic works correctly

### Record
- **Measured bitrate (100% budget):** __________ kbit/s (expected ~40)
- **Budget remained high:** YES / NO
- **Test result:** PASS / FAIL
- **Screenshot saved:** YES / NO
- **Console errors:** (list any, or write NONE)

---

## Test 5: Persistence Across Reload

### Setup
1. Navigate to Call Budget settings
2. Select **Data Saver**
3. Save and return

### Test Persistence
4. **Reload the page** (Ctrl+R or F5)
5. Navigate back to Call Budget settings
6. Check which quality is selected — should still be **Data Saver**
7. If needed, inspect localStorage in DevTools:
   - Open Console → type: `JSON.parse(localStorage.getItem('soko_call_budget_video'))`
   - Check if `quality: 'saver'` is present

### Expected Result
- ✅ Data Saver remains selected after reload
- ✅ localStorage contains `quality: 'saver'`
- ✅ Starting a call after reload still uses 40 kbit/s cap

### Record
- **Quality after reload:** __________ (expected: Data Saver)
- **localStorage check:** PASS / FAIL
- **Test result:** PASS / FAIL

---

## Test 6: Console Errors Check

### For Each Quality Tier
During Tests 1-4 above, after each call starts:

1. Open Browser DevTools (F12)
2. Go to Console tab
3. Check for any errors (red text)
4. Specifically look for:
   - `setParameters failed`
   - `getParameters`
   - `maxBitrate`
   - Any WebRTC-related errors
   - React errors or warnings

### Expected Result
- ✅ No errors when call starts
- ✅ No errors during call
- ✅ No errors when quality changes

### Record
- **Data Saver call — console errors:** (list any, or write NONE)
- **Balanced call — console errors:** (list any, or write NONE)
- **High Quality call — console errors:** (list any, or write NONE)
- **Overall result:** PASS / FAIL

---

## Summary Checklist

After completing all tests above, verify:

- [ ] Test 1: Data Saver holds at ≤40 kbit/s
- [ ] Test 2: Balanced holds at ≤200 kbit/s
- [ ] Test 3: High starts uncapped, adaptive steps down correctly
- [ ] Test 4: Data Saver + full budget still caps at 40 kbit/s (edge case)
- [ ] Test 5: Quality selection persists after reload
- [ ] Test 6: No console errors for any quality tier
- [ ] Screenshots captured for all bitrate measurements
- [ ] All measured values documented above

---

## How to Read WebRTC Stats

### Chrome/Edge (`chrome://webrtc-internals`)
1. Look for the **RTCPeerConnection** section (usually at top)
2. Expand it → find **Stats graphs for [connection-id]**
3. Find the track labeled `RTCOutboundRTPVideoStream` or similar
4. Look for one of these fields:
   - `googTargetEncodebitrate` (in bits/sec)
   - Graph labeled "bitrate" (hover over line to see value)
   - `bytesSent` graph → slope indicates rate

### Firefox (`about:webrtc`)
1. Find the **Connection** section
2. Click **Show Statistics**
3. Find the **outbound-rtp** with `kind: video`
4. Look for `bitrate` or `targetBitrate` field

### Converting Units
- 40 kbit/s = 40,000 bits/sec = 5,000 bytes/sec
- 200 kbit/s = 200,000 bits/sec = 25,000 bytes/sec

If you see `bytesSent` instead of bitrate:
- Note the value at two points 1 second apart
- `bitrate = (bytes₂ - bytes₁) × 8` bits per second

---

## Reporting Results

After completing all tests, compile:
1. All measured bitrate values (from Tests 1-4)
2. Pass/Fail for each test
3. Screenshots (save to `docs/quality-picker-test-screenshots/`)
4. Any console errors found
5. Any unexpected behavior

**Create a test report:**
- Copy this script
- Fill in all "Record" sections with actual values
- Mark all checkboxes in Summary Checklist
- Save as `docs/quality-picker-test-results.md`
- Report back with summary

---

## Troubleshooting

### Bitrate not visible in webrtc-internals
- Refresh the page after call starts
- Try looking at `bytesSent` graph instead
- Check if video is actually flowing (not frozen)

### Bitrate higher than expected
- Verify correct quality was selected and saved
- Check localStorage to confirm quality value
- Try reloading page before call
- Check for console errors

### Adaptive steps not triggering (Test 3)
- Use a very low budget (5 MB or less)
- Let call run longer (5+ minutes)
- Check if budget enforcement is enabled

### Quality doesn't persist (Test 5)
- Check if localStorage is enabled in browser
- Try incognito/private mode
- Check for localStorage errors in console
