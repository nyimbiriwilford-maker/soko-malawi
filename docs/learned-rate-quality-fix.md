# Learned Rate System — Quality Tier Bypass Fixed

## Root Cause Found

**Data Saver and Balanced estimates were completely bypassing learned rates**, using only hardcoded theoretical values that don't match real-world consumption.

### Before Fix

**`callBudgetPrefs.js:193-211` (effectiveEstimateDuration)**
```javascript
export function effectiveEstimateDuration(callType, mb, lowDataMode) {
  const fallback = RATES[callType][lowDataMode ? 'lowData' : 'normal']
  if (lowDataMode) {
    return (mb * 1024 * 1024) / fallback  // ❌ EARLY RETURN — never checks learned rates
  }
  const learned = getLearnedRates()
  const rate = learned[callType] ?? fallback
  return (mb * 1024 * 1024) / rate
}
```

**`CallBudget/index.jsx:78-82` (customVideoSec)**
```javascript
function customVideoSec(mb, qId) {
  if (qId === 'saver')    return (mb * 1024 * 1024) / 5000   // ❌ Hardcoded 40 kbit/s
  if (qId === 'balanced') return (mb * 1024 * 1024) / 25000  // ❌ Hardcoded 200 kbit/s
  return effectiveEstimateDuration('video', mb, false)       // Only 'high' checked learned rates
}
```

### Why This Was Wrong

1. **Data Saver calls returned early** before `getLearnedRates()` was ever called
2. **Custom budget with Data Saver** hardcoded `/ 5000` (assumes 40 kbit/s holds perfectly)
3. **Custom budget with Balanced** hardcoded `/ 25000` (assumes 200 kbit/s holds perfectly)
4. **Only "High Quality" tier** reached the learned-rate logic

Even if the bitrate cap bug gets fixed and target rates hold on the wire, **real-world conditions** (codec overhead, network jitter, negotiation differences) mean actual consumption differs from theoretical targets. That's exactly what the learned-rate system is supposed to capture.

The original comment at line 187 said:
```javascript
// Low-data mode always uses the fixed rate (not enough variance to learn from).
```

But the user's 15MB Data Saver call consuming data much faster than the 40 kbit/s assumption proves there IS variance worth learning.

---

## Solution

### 1. Refactored `effectiveEstimateDuration()` — No More Early Return

**`callBudgetPrefs.js:185-217`**

```javascript
/**
 * Like estimateDuration but uses the learned rate when ≥2 samples exist.
 * Now uses learned rates for ALL quality tiers (saver/balanced/high) when available,
 * falling back to theoretical rates only when insufficient samples exist.
 */
export function effectiveEstimateDuration(callType, mb, qualityHint = null) {
  // Quality-specific fallback rates (theoretical targets)
  const fallbackRates = {
    saver: 5000,      // 40 kbit/s target
    balanced: 25000,  // 200 kbit/s target
    normal: RATES[callType].normal,  // 265 KB/s for video, 10 KB/s for voice
  }

  const fallback = qualityHint ? (fallbackRates[qualityHint] ?? RATES[callType].normal) : RATES[callType].normal

  // ✅ Try to use learned rate for this call type, REGARDLESS of quality tier
  const learned = getLearnedRates()
  const rate = learned[callType] ?? fallback

  console.log('[effectiveEstimateDuration]', {
    callType,
    mb,
    qualityHint,
    learnedRate: learned[callType],
    fallbackRate: fallback,
    usedRate: rate,
    usingLearned: learned[callType] !== undefined,
    estimatedSeconds: (mb * 1024 * 1024) / rate,
  })

  return (mb * 1024 * 1024) / rate
}
```

**Key changes:**
- Parameter changed from `lowDataMode: boolean` to `qualityHint: string|null` ('saver' | 'balanced' | null)
- No more early return — learned rates are ALWAYS checked first
- Falls back to quality-specific theoretical rates only when `learned[callType]` is `null` (< 2 samples)
- Enhanced logging shows whether learned rate is being used

### 2. Simplified `customVideoSec()` — Delegates to Learned System

**`CallBudget/index.jsx:78-81`**

```javascript
function customVideoSec(mb, qId) {
  // ✅ All quality tiers now use learned rates when available
  return effectiveEstimateDuration('video', mb, qId)
}
```

**Before:** 'saver' and 'balanced' hardcoded rates  
**After:** All qualities delegate to `effectiveEstimateDuration()` which checks learned rates first

### 3. Updated Call Sites

**`CallBudget/index.jsx:114-121`** (durations for preset buttons)
```javascript
function durations(key) {
  const mb = BUDGET_PRESETS[callType][key]
  const savedPref = getCallBudgetPref(callType)
  const qualityForThisPreset = savedPref?.preset === key ? savedPref.quality : 'balanced'
  return {
    video: effectiveEstimateDuration('video', mb, callType === 'video' ? qualityForThisPreset : null),
    audio: effectiveEstimateDuration('voice', mb, null),
  }
}
```

**`CallBudget/index.jsx:122-124`** (custom budget estimates)
```javascript
const customD = isCustom && validCustom
  ? { video: customVideoSec(customMb, quality), audio: effectiveEstimateDuration('voice', customMb, null) }
  : null
```

**`CallDataMeter.jsx:167-178`** (in-call remaining time)
```javascript
const pref = getCallBudgetPref(callType)
const qualityHint = pref?.quality || null

let remainingSeconds
if (measuredRate && measuredRate > 0) {
  remainingSeconds = (remainingMb * MB) / measuredRate
} else {
  remainingSeconds = effectiveEstimateDuration(callType, remainingMb, qualityHint)
}
```

---

## Impact

### Before Fix
- **Data Saver estimate**: Always `(15 * 1024 * 1024) / 5000 = 3145 sec = ~52 min` (hardcoded)
- **Balanced estimate**: Always `(15 * 1024 * 1024) / 25000 = 629 sec = ~10 min` (hardcoded)
- **High estimate**: Uses learned rate if ≥2 samples exist

### After Fix
- **All quality tiers** check learned rates first
- **Fallback to theoretical rates** only when < 2 valid samples exist
- **Real-world consumption** captured and used for future estimates

### Example Flow (After 2+ Data Saver Calls Logged)

```
[getLearnedRates] Full usage log: [
  { callType: 'video', bytesUsed: 15728640, durationSec: 540, budgetCapped: false, quality: 'saver' },
  { callType: 'video', bytesUsed: 31457280, durationSec: 1200, budgetCapped: false, quality: 'saver' }
]
[getLearnedRates] Valid video records: [{ ... }, { ... }]
[getLearnedRates] video rates: [29127, 26214] → median: 27670 bytes/sec
[getLearnedRates] ✅ video learned rate accepted: 27670 bytes/sec
[getLearnedRates] Final result: { voice: null, video: 27670 }

[effectiveEstimateDuration] {
  callType: 'video',
  mb: 15,
  qualityHint: 'saver',
  learnedRate: 27670,        // ← Learned from real calls
  fallbackRate: 5000,        // ← Theoretical 40 kbit/s
  usedRate: 27670,           // ← Using learned!
  usingLearned: true,
  estimatedSeconds: 567      // ~9.5 min (matches reality, not ~52 min hardcoded)
}
```

---

## Why Learned Rates Matter for Data Saver

Even if the 40 kbit/s bitrate cap is successfully applied:

1. **Codec overhead** — Video codecs don't compress exactly to target bitrate
2. **Audio track** — Opus codec runs at ~80 kbit/s, not throttled by video cap
3. **Protocol overhead** — RTP/SRTP headers, STUN keepalives, ICE candidates
4. **Network jitter** — Retransmissions and buffering affect real consumption
5. **Negotiation differences** — Different browsers/devices may interpret caps differently

Theoretical 40 kbit/s video + 80 kbit/s audio = 120 kbit/s = **15 KB/s**, but user's actual consumption was **29 KB/s** (15MB in 9 min). That's why learned rates are essential.

---

## Files Modified

1. **`src/lib/callBudgetPrefs.js`** (lines 185-217)
   - Refactored `effectiveEstimateDuration()` to check learned rates for ALL quality tiers
   - Changed parameter from `lowDataMode: boolean` to `qualityHint: string|null`
   - Enhanced logging to show `usingLearned: true/false`

2. **`src/pages/CallBudget/index.jsx`** (lines 78-81, 114-124)
   - Simplified `customVideoSec()` to delegate to learned system
   - Updated `durations()` to pass quality hint instead of boolean
   - Updated custom budget calculation

3. **`src/components/CallDataMeter.jsx`** (lines 167-178)
   - Changed from `lowDataMode: boolean` to `qualityHint: string`
   - Now passes actual quality ('saver'/'balanced'/null) for proper fallback selection

---

## Build Status

✅ **Build successful** — No errors or warnings  
✅ **All quality tiers** now use learned rates when available  
✅ **Logging enhanced** to show learned vs fallback usage  

---

## Testing

After this fix + the existing logging from `learned-rate-debugging.md`:

1. **Run 2+ Data Saver calls** (each ≥60 seconds, not budget-capped)
2. **Check localStorage** `soko_call_usage_log` to confirm records saved
3. **Return to Call Budget page** and set 15MB Data Saver
4. **Check console** for `[effectiveEstimateDuration]` log showing:
   - `usingLearned: true`
   - `usedRate: <actual-learned-rate>` (should be ~27-29k bytes/sec based on user's report)
   - `estimatedSeconds: <realistic-value>` (should be ~9-10 min, not ~52 min)

The estimate will now update after qualifying calls complete, regardless of quality tier.
