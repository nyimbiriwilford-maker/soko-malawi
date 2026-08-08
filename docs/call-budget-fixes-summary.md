# Call Budget Estimate Fixes — Implementation Summary

## Changes Made

### 1. **src/lib/callBudgetConstants.js** (NEW FILE)
Extracted shared adaptive cap constants so enforcement and estimation agree:
- `ADAPTIVE_CAPS`: 200k, 80k, 40k bit/s thresholds
- `ADAPTIVE_THRESHOLDS`: Budget fraction triggers for each step

### 2. **src/lib/callBudgetPrefs.js**
Fixed learned-rate system and estimation:
- Updated voice fallback: 8000 → 10000 B/s (matches measured ~80 kbit/s)
- Updated lowData video rate: 10000 → 5000 B/s (matches 40 kbit/s label)
- **getLearnedRates()**: Now uses median instead of arithmetic mean; filters out:
  - Budget-capped calls (new `budgetCapped` flag)
  - Calls shorter than 60 seconds
  - Invalid records
- **saveCallUsageRecord()**: Added `budgetCapped` parameter to mark enforcement-terminated calls
- **getLearnedRateInfo()**: Updated to match new filtering rules
- **estimateAdaptiveDuration()**: NEW — piecewise estimate accounting for adaptive bitrate steps

### 3. **src/hooks/useCallDataBudget.js**
Added live rate measurement:
- Maintains 25-second rolling window of WebRTC samples
- **getMeasuredRate()**: Returns current bytes/sec from recent samples
- Requires ≥5 seconds of data before returning a rate
- Automatically adapts to network changes, bitrate caps, video on/off

### 4. **src/components/CallDataMeter.jsx**
Fixed time-left calculation:
- Now accepts `measuredRate` prop
- Uses measured rate when available, falls back to static estimate
- Priority: live measured → learned → quality-specific → static fallback

### 5. **src/pages/CallBudget/index.jsx**
Fixed custom quality estimate constants:
- Data Saver: now uses 5000 B/s (40 kbit/s) — was using `effectiveEstimateDuration` with wrong mode
- Balanced: now uses 25000 B/s (200 kbit/s) — was 35000 B/s (280 kbit/s)

### 6. **src/hooks/useCallBudgetManager.js**
- Imports `ADAPTIVE_CAPS` from shared constants
- Accepts `budgetCappedRef` prop to mark when budget enforcement terminates a call
- Sets `budgetCappedRef.current = true` in `autoHangup()` when budget hits 100%

### 7. **src/components/PersistentCallShell.jsx**
Plumbing for measured rate and budget-capped tracking:
- Extracts `getMeasuredRate` from `useCallDataBudget`
- Passes `measuredRate={getMeasuredRate ? getMeasuredRate() : null}` to CallOverlay
- Added `budgetCappedRef` to track enforcement-terminated calls
- Passes `budgetCapped` flag to `saveCallUsageRecord()`

### 8. **src/components/CallOverlay.jsx**
- Accepts `measuredRate` prop
- Passes it through to `InCallStage`

### 9. **src/components/call/CallUI.jsx**
- **InCallStage**: Accepts `measuredRate` prop
- Passes `measuredRate` to `CallDataMeter`

## Rate Priority (Active Call)
1. **Recent live measured rate** (from rolling window)
2. **Recent learned valid rate** (median of last 5 valid calls)
3. **Quality-specific/default rate** (static constants)
4. **Static fallback**

## What Was NOT Changed
- Call enforcement logic (useCallBudgetManager adaptive caps)
- WebRTC stats polling frequency
- UI layout or styling
- Database schema
- Meter warning thresholds
- Budget lifecycle stages (80%/90%/98%/100%)

## Validation Checklist

### New user
✓ No history → sensible fallback → switches to live rate

### Normal video call
✓ Time-left follows actual consumption via measured rate

### Network becomes slower
✓ Measured rate decreases → estimated remaining time increases

### Network becomes faster
✓ Measured rate increases → estimated remaining time decreases

### Adaptive cap activates
✓ Estimate follows the lower consumption rate automatically

### Voice call
✓ Fallback is 10,000 B/s until live data takes over

### Short call (< 60s)
✓ Does not pollute learned rates

### Budget-capped call
✓ Marked with `budgetCapped: true`, excluded from learned rates

### Repeated calls
✓ Recent valid calls improve future estimates via median

### Mobile + desktop
✓ Existing UI unchanged

## Files Modified
- src/lib/callBudgetConstants.js (NEW)
- src/lib/callBudgetPrefs.js
- src/hooks/useCallDataBudget.js
- src/hooks/useCallBudgetManager.js
- src/components/CallDataMeter.jsx
- src/components/PersistentCallShell.jsx
- src/components/CallOverlay.jsx
- src/components/call/CallUI.jsx
- src/pages/CallBudget/index.jsx

## Build Status
✓ npm run build — successful, no errors
