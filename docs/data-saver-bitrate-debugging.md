# Data Saver Bitrate Cap Debugging — Diagnostic Logs Added

## Issue Summary

User tested Data Saver mode and observed ~200 kbit/s actual bandwidth (balanced rate) instead of the expected 40 kbit/s cap. The UI correctly shows "Data Saver" selected, but the bitrate cap isn't holding on the real connection.

## Debugging Added

### Enhanced Console Logging in `applyLowDataIfConfigured()`

Added comprehensive logging at every step to diagnose why the 40k cap isn't being applied:

**Line 812** — Function entry
```javascript
console.log('[applyLowDataIfConfigured] CALLED', { callType })
```

**Line 819** — User preference resolution
```javascript
console.log('[applyLowDataIfConfigured] User pref:', { pref, quality })
```

**Line 833** — Resolved bitrate target
```javascript
console.log('[applyLowDataIfConfigured] Target maxBitrate:', maxBitrate, 'bps')
```

**Line 836** — Senders inspection
```javascript
console.log('[applyLowDataIfConfigured] Total senders:', senders.length)
```

**Line 840-846** — Per-sender track inspection
```javascript
console.log('[applyLowDataIfConfigured] Checking sender:', {
  hasTrack: !!track,
  trackKind: track?.kind,
  trackId: track?.id,
  trackState: track?.readyState,
})
```

**Line 851-857** — Parameters before setParameters()
```javascript
console.log('[applyLowDataIfConfigured] BEFORE setParameters:', {
  hasEncodings: !!paramsBefore.encodings,
  encodingsLength: paramsBefore.encodings?.length,
  currentMaxBitrate: paramsBefore.encodings?.[0]?.maxBitrate,
  transactionId: paramsBefore.transactionId,
})
```

**Line 866-871** — Success confirmation
```javascript
console.log('[applyLowDataIfConfigured] ✅ setParameters SUCCESS:', {
  appliedMaxBitrate: paramsAfter.encodings?.[0]?.maxBitrate,
  fullEncodings: paramsAfter.encodings?.[0],
})
```

**Line 873** — Failure case
```javascript
console.error('[applyLowDataIfConfigured] ❌ setParameters FAILED:', err)
```

## What to Check in Console

When you start a Data Saver video call, look for these logs:

### Expected Flow (Data Saver working)
```
[applyLowDataIfConfigured] CALLED { callType: 'video' }
[applyLowDataIfConfigured] User pref: { pref: { quality: 'saver', ... }, quality: 'saver' }
[applyLowDataIfConfigured] Target maxBitrate: 40000 bps
[applyLowDataIfConfigured] Total senders: 2
[applyLowDataIfConfigured] Checking sender: { hasTrack: true, trackKind: 'audio', ... }
[applyLowDataIfConfigured] Checking sender: { hasTrack: true, trackKind: 'video', trackState: 'live' }
[applyLowDataIfConfigured] Found VIDEO sender, applying cap
[applyLowDataIfConfigured] BEFORE setParameters: { hasEncodings: true, currentMaxBitrate: undefined, ... }
[applyLowDataIfConfigured] Calling setParameters with maxBitrate: 40000
[applyLowDataIfConfigured] ✅ setParameters SUCCESS: { appliedMaxBitrate: 40000, ... }
```

### Common Failure Scenarios

**Scenario 1: Function not called at all**
- No logs appear → `applyLowDataIfConfigured()` never runs
- Check: Is the function being called from `startCall()` and `answerCall()`?

**Scenario 2: Wrong quality value**
- Logs show `quality: 'balanced'` instead of `'saver'`
- Check: Is the preference being saved correctly in CallBudget page?

**Scenario 3: No video sender found**
- Logs show "Checking sender" for audio only, no video sender
- **This is the most likely issue** — video track not attached when function runs
- The cap is applied **before** the video track exists, so it binds to nothing

**Scenario 4: setParameters fails**
- Logs show ❌ FAILED error
- Check the error message for why (InvalidStateError, InvalidModificationError, etc.)

**Scenario 5: Track is null or not 'live'**
- Logs show `hasTrack: false` or `trackState: 'ended'`
- Video track not ready when cap is applied

## Next Steps

1. **Start a Data Saver video call** with dev console open
2. **Capture the full console output** from `[applyLowDataIfConfigured]` logs
3. **Look for**:
   - Is the function being called?
   - What quality value is resolved? ('saver' expected)
   - How many senders exist?
   - Does a video sender exist with a live track?
   - Does setParameters succeed?
   - What's the appliedMaxBitrate after success?

4. **If video sender has no track or track is null**:
   - The bug is that `applyLowDataIfConfigured()` runs **before** `pc.addTrack(videoTrack, stream)`
   - Or the track is added but not yet negotiated
   - Need to move the cap application to **after** tracks are confirmed attached

## Files Modified

- **`src/hooks/useWebRTC.js`** (lines 811-874)
  - Added 10+ console.log statements for debugging
  - No logic changes, only diagnostic logging

## Build Status

✅ Build successful — ready for debugging test
