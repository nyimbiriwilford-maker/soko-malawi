# Learned Rate System — Debugging Added

## Issue Summary

User completed a 15MB Data Saver video call that lasted ~9 minutes (much faster consumption than expected). After the call ended, the Call Budget page still shows ~52 min estimate for 15MB/Data Saver — completely unchanged, indicating learned rates are not updating.

## Debugging Added

### 1. Call End Recording — `PersistentCallShell.jsx:136-151`

Added logging right before `saveCallUsageRecord()` is called:

```javascript
console.log('[PersistentCallShell] SAVING usage record:', {
  callType: callSummary.callType,
  bytesUsed: callSummary.bytesUsed,
  duration: callSummary.duration,
  budgetCapped: callSummary.budgetCapped || false,
})
```

**What to check:**
- Is this log appearing when a call ends?
- What are the actual values being saved?
- Is `budgetCapped` true or false for Data Saver calls?

### 2. Storage Write — `callBudgetPrefs.js:109-119`

Added logging inside `saveCallUsageRecord()`:

```javascript
console.log('[saveCallUsageRecord] Adding record:', record)
// ... localStorage.setItem() ...
console.log('[saveCallUsageRecord] Saved to localStorage. Total records:', trimmed.length)
```

**What to check:**
- Did the record actually get written to localStorage?
- How many total records exist after save?
- Verify localStorage key `soko_call_usage_log` exists after call

### 3. Rate Calculation — `callBudgetPrefs.js:127-165`

Added comprehensive logging in `getLearnedRates()`:

```javascript
console.log('[getLearnedRates] Full usage log:', log)
// ... filter for each call type ...
console.log(`[getLearnedRates] Valid ${type} records:`, records)
console.log(`[getLearnedRates] Not enough ${type} records (need ≥2, have ${records.length})`)
console.log(`[getLearnedRates] ${type} rates:`, rates, '→ median:', median, 'bytes/sec')
console.log(`[getLearnedRates] ✅ ${type} learned rate accepted:`, median, 'bytes/sec')
console.log(`[getLearnedRates] ❌ ${type} median out of bounds (125–1250000):`, median)
console.log('[getLearnedRates] Final result:', result)
```

**What to check:**
- How many records are in the log?
- How many pass the filter (callType='video', bytesUsed>0, duration≥60s, !budgetCapped)?
- What's the calculated median rate?
- Is the median accepted or rejected (bounds check)?

### 4. Estimate Calculation — `callBudgetPrefs.js:193-207`

Added logging in `effectiveEstimateDuration()`:

```javascript
console.log('[effectiveEstimateDuration]', {
  callType,
  mb,
  lowDataMode,
  learnedRate: learned[callType],
  fallbackRate: fallback,
  usedRate: rate,
  estimatedSeconds: (mb * 1024 * 1024) / rate,
})
```

**What to check:**
- Is `getLearnedRates()` being called when estimating?
- Does it return a learned rate for 'video'?
- Is the learned rate being used, or is it falling back to default?
- What's the final estimated duration?

---

## How to Test

1. **Start a test call** (Data Saver, 15MB budget)
2. **Let it run** for at least 60 seconds (minimum duration for learned rates)
3. **End the call** (hangup or let budget run out)
4. **Check console** for `[PersistentCallShell] SAVING usage record:` log
5. **Open DevTools Application tab** → Local Storage → check `soko_call_usage_log` key
6. **Return to Call Budget page** and change budget/quality to trigger re-calculation
7. **Check console** for all `[getLearnedRates]` and `[effectiveEstimateDuration]` logs

---

## Expected Flow (Working System)

### After Call Ends:
```
[PersistentCallShell] SAVING usage record: {
  callType: 'video',
  bytesUsed: 15728640,  // 15 MB
  duration: 540,         // 9 minutes
  budgetCapped: false    // ← CRITICAL: should be false for Data Saver
}
[saveCallUsageRecord] Adding record: { ... }
[saveCallUsageRecord] Saved to localStorage. Total records: 1
```

### When Calculating Estimate:
```
[getLearnedRates] Full usage log: [{ callType: 'video', bytesUsed: 15728640, durationSec: 540, budgetCapped: false }]
[getLearnedRates] Valid video records: [] ← ISSUE: Empty because only 1 record (need ≥2)
[getLearnedRates] Not enough video records (need ≥2, have 1)
[getLearnedRates] Final result: { voice: null, video: null }
[effectiveEstimateDuration] { 
  callType: 'video',
  mb: 15,
  lowDataMode: true,
  learnedRate: null,        ← Falls back because <2 samples
  fallbackRate: 6510,       ← Data Saver default (40 kbit/s)
  usedRate: 6510,
  estimatedSeconds: 3123    ← ~52 minutes (unchanged from before)
}
```

---

## Common Failure Scenarios

### Scenario 1: `saveCallUsageRecord()` Never Called
- No `[PersistentCallShell] SAVING` log appears
- **Root cause**: Call ended without `callSummary` being set
- **Check**: Line 123-127 — is `budgetMb > 0` false? (15MB should be > 0)

### Scenario 2: `budgetCapped: true` for Data Saver Calls
- Log shows `budgetCapped: true` even though call wasn't terminated by budget enforcement
- **Root cause**: Data Saver low-bitrate ceiling confused with budget-enforcement capping
- **Check**: Line 95 in `useCallBudgetManager.js` — is `budgetCappedRef.current = true` being set when it shouldn't?
- **Expected**: `budgetCapped` should ONLY be true when `autoHangup()` fires (budget actually ran out)

### Scenario 3: Record Saved But Filtered Out
- `[saveCallUsageRecord]` logs show save succeeded
- `[getLearnedRates]` shows 0 valid records after filter
- **Possible reasons**:
  - `callType` doesn't match 'video' (typo?)
  - `bytesUsed` is 0 or negative
  - `durationSec` < 60 (call too short)
  - `budgetCapped: true` (incorrectly flagged)

### Scenario 4: Not Enough Samples Yet
- Only 1 valid record exists, but system requires ≥2
- **Expected behavior**: After FIRST qualifying call, estimate won't change yet
- **Solution**: Run a SECOND qualifying call, then check if estimate updates

### Scenario 5: Median Out of Bounds
- Learned rate calculated but rejected (not between 125–1,250,000 bytes/sec)
- **Check**: Console log for `❌ median out of bounds`
- 15MB in 9min = 29127 bytes/sec (well within bounds, should be accepted)

### Scenario 6: `lowDataMode` Always True
- Line 195: If `lowDataMode` is true, learned rates are NEVER consulted
- Returns immediately with fallback
- **Check**: Is Data Saver preference being passed as `lowDataMode: true` to estimate function?
- **Expected**: Data Saver calls should STILL learn and use learned rates (not bypass them)

---

## Key Discovery Points

### `budgetCapped` Flag Logic
From `useCallBudgetManager.js:95`:
```javascript
if (budgetCappedRef) budgetCappedRef.current = true
```

This is ONLY set in `autoHangup()` function, which fires when:
- Budget usage reaches 100%
- Countdown expires without extension

**Data Saver calls ending normally should have `budgetCapped: false`.**

### Learned Rates Requirements
From `callBudgetPrefs.js:128-137`:
```javascript
const records = log.filter(r =>
  r.callType === type &&
  r.bytesUsed > 0 &&
  r.durationSec >= 60 &&    // ← Must be ≥60 seconds
  !r.budgetCapped            // ← Must NOT be budget-capped
).slice(-5)                  // Most recent 5

if (records.length < 2) continue  // ← Need at least 2 qualifying calls
```

### Storage Key
- **localStorage key**: `soko_call_usage_log`
- **Max records**: 10 (older records trimmed)
- **Format**: JSON array of `{ callType, bytesUsed, durationSec, budgetCapped }`

---

## Files Modified

1. **`src/components/PersistentCallShell.jsx`** (lines 139-144)
   - Added console.log before saveCallUsageRecord() call

2. **`src/lib/callBudgetPrefs.js`** (lines 109-165, 193-207)
   - Added logging in saveCallUsageRecord()
   - Added comprehensive logging in getLearnedRates()
   - Added logging in effectiveEstimateDuration()

---

## Build Status

✅ **Build successful** — No errors or warnings  
✅ **All logging added** — Ready for debugging test

---

## Next Steps

1. Run a test call with console open
2. Capture all `[PersistentCallShell]`, `[saveCallUsageRecord]`, `[getLearnedRates]`, and `[effectiveEstimateDuration]` logs
3. Inspect localStorage `soko_call_usage_log` key after call ends
4. Report back what was actually logged and saved

The logs will reveal exactly where in the pipeline the learned rate system is failing.
