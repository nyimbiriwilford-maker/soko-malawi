# Quality Picker Implementation — Wired to Actual Call Bitrate

## Summary

The call quality picker (Data Saver / Balanced / High Quality) now controls the actual outgoing video bitrate, not just the time estimate. The user's selection acts as a ceiling that the adaptive budget system respects.

## Changes Made

### 1. **src/lib/callBudgetPrefs.js**
- Updated `getCallBudgetPref()` to return the `quality` field (defaults to 'balanced')
- Updated `setCallBudgetPref()` to save the `quality` field
- **Replaced `shouldAutoLowData()`**: Now reads the user's saved quality preference and returns `true` when Data Saver ('saver') is selected

### 2. **src/pages/CallBudget/index.jsx**
- Updated `handleStart()` to save the `quality` selection along with preset/mb
- Updated quality state initialization to load saved quality from localStorage (defaults to 'balanced')

### 3. **src/hooks/useWebRTC.js**
- Added import for `getCallBudgetPref`
- **Rewrote `applyLowDataIfConfigured()`**: Now applies user-selected quality cap at call start
  - Data Saver: 40 kbit/s (40,000 bits/sec)
  - Balanced: 200 kbit/s (200,000 bits/sec)
  - High: no user-imposed ceiling
  - Applied via `sender.setParameters()` to all video senders when peer connection is established

### 4. **src/hooks/useCallBudgetManager.js**
- Added import for `getCallBudgetPref`
- **Updated `applyAdaptiveCap()`**: Adaptive system now respects user's quality ceiling
  - If adaptive wants to apply a higher bitrate than user's ceiling, uses the ceiling instead
  - If adaptive wants no cap (step 0) but user has a ceiling, enforces the ceiling
  - Adaptive system can still step quality lower as budget depletes, but never exceeds user's choice

## Bitrate Values Used

| Quality      | Bitrate   | Applied Where                              |
|--------------|-----------|-------------------------------------------|
| Data Saver   | 40 kbit/s | Initial cap + adaptive ceiling            |
| Balanced     | 200 kbit/s| Initial cap + adaptive ceiling            |
| High Quality | uncapped  | No initial cap, adaptive applies as budget depletes |

## How It Works

**Call Start:**
1. User selects quality in CallBudget page, it's saved to localStorage
2. When call starts, `applyLowDataIfConfigured()` reads the saved quality
3. For Data Saver/Balanced, applies initial maxBitrate to video sender
4. For High, no initial cap is applied

**During Call (Adaptive System):**
1. Every 5 seconds, budget manager checks remaining budget fraction
2. Calculates adaptive step (0=normal, 1=200k, 2=80k, 3=40k)
3. `applyAdaptiveCap()` compares adaptive cap vs user ceiling
4. Applies the LOWER of the two (user ceiling acts as maximum)
5. Example: User chose Balanced (200k ceiling), budget at 15% → adaptive wants 80k → applies 80k ✓
6. Example: User chose Data Saver (40k ceiling), budget at 100% → adaptive wants uncapped → applies 40k ceiling ✓

## What Wasn't Changed

- Call enforcement logic structure
- Estimate math, learned rates, live measurement (previous pass)
- UI styling, labels, or layout
- Budget thresholds (80% toast, 90% panel, 98% countdown)
- Meter display or warnings

## Validation Checklist

- [x] Build passes
- [ ] Manual test: Data Saver selected → call bitrate stays ≤40 kbit/s (check WebRTC stats)
- [ ] Manual test: Balanced selected → call bitrate stays ≤200 kbit/s
- [ ] Manual test: High selected → call bitrate uncapped initially, adaptive applies as budget depletes
- [ ] Manual test: Data Saver + low budget → adaptive tries 80k but ceiling holds at 40k
- [ ] Verify no console errors on call start
- [ ] Verify quality selection persists across page reload

## Testing Instructions

1. Open browser DevTools → chrome://webrtc-internals (Chrome) or about:webrtc (Firefox)
2. Set quality to Data Saver, start a video call
3. In WebRTC stats, find the video sender track
4. Check `googTargetEncodebitrate` or similar field
5. Confirm bitrate stays at or below ~40 kbit/s throughout the call
6. Repeat for Balanced (≤200 kbit/s) and High (uncapped initially)
