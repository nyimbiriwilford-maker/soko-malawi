# Task 11 — Surface the real getUserMedia error (diagnostic only)

Status: DONE. All getUserMedia call sites in the two files now log `error.name` + `error.message` and show the error name to the user. No permission-request logic, `CallBudgetSelector.jsx`, `callBitrateCap.js`, or `useCallDataBudget.js` touched.

## All getUserMedia call sites (surrounding code verbatim, pre-fix)

### `src/hooks/useWebRTC.js` — 3 sites

**1. `startCall(type)`** (caller path):
```js
const stream = await navigator.mediaDevices
  .getUserMedia({ audio: true, video: type === 'video' })
  .catch(() => null)

if (!stream) {
  alert('Microphone/camera access denied')
  endCallLocally()
  return
}
```

**2. `answerCall()`** (callee path):
```js
const stream = await navigator.mediaDevices
  .getUserMedia({ audio: true, video: type === 'video' })
  .catch(() => null)

if (!stream) {
  alert('Microphone/camera access denied')
  await declineCall()
  return
}
```

**3. `switchCamera()`**:
```js
const newStream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: { deviceId: { exact: nextDevice.deviceId } },
})
...
} catch (e) {
  console.error('switchCamera error:', e)
  alert('Camera switch failed: ' + e.message)
}
```

### `src/components/GlobalCallListener.jsx` — 2 sites

**1. `answerWithOffer(src)`**:
```js
const stream = await navigator.mediaDevices
  .getUserMedia({ audio: true, video: type === 'video' })
  .catch(() => null)

if (!stream) {
  alert('Microphone/camera access denied')
  await handleDecline()
  return
}
```

**2. `handleSwitchCamera()`**:
```js
const newStream = await navigator.mediaDevices.getUserMedia({
  audio: false, video: { deviceId: { exact: nextDevice.deviceId } },
})
...
} catch (e) { alert('Camera switch failed: ' + e.message) }
```

## How the catch currently produced "access denied"

In all three call/answer sites the `getUserMedia` promise used `.catch(() => null)` — **the error object was discarded entirely** (no console log), and the `if (!stream)` guard then showed the **hardcoded generic string** `'Microphone/camera access denied'` regardless of `error.name`. So `NotAllowedError`, `NotReadableError`, `OverconstrainedError`, `NotFoundError`, etc. were all indistinguishable. The `switchCamera` sites were slightly better (they did surface `e.message`) but omitted `error.name`.

## Fix — updated catch blocks (both call sites)

Pattern applied to all three access-denied sites — capture the error, log `name` + `message`, and include the name in the alert (falling back to the generic text only if `name` is somehow absent):

**`useWebRTC.js` `startCall`** (startCall):
```js
let gUMError = null
const stream = await navigator.mediaDevices
  .getUserMedia({ audio: true, video: type === 'video' })
  .catch((err) => {
    gUMError = err
    console.error('[getUserMedia]', err?.name, err?.message)
    return null
  })

if (!stream) {
  alert(gUMError?.name ? `Camera/microphone error: ${gUMError.name}` : 'Microphone/camera access denied')
  endCallLocally()
  return
}
```

**`useWebRTC.js` `answerCall`** (callee): identical block, but the failure branch is `await declineCall()`.

**`GlobalCallListener.jsx` `answerWithOffer`**: identical block, failure branch is `await handleDecline()`.

**`useWebRTC.js` `switchCamera`** catch:
```js
} catch (e) {
  console.error('switchCamera error:', e?.name, e?.message)
  alert('Camera switch failed: ' + (e?.name ? `${e.name}: ` : '') + e?.message)
}
```

**`GlobalCallListener.jsx` `handleSwitchCamera`** catch: same enhanced log + alert.

## What this surfaces for Ethel's case

- `NotAllowedError` → a real permission denial (Chrome settings say Allow, so check for a second browser/OS-level block).
- `NotReadableError` → device is already in use by another tab/app or locked by the OS.
- `OverconstrainedError` → the requested `{audio:true, video:true}` combo or a device constraint is unsatisfiable.
- `NotFoundError` → no camera/mic attached.
Any of these now appear in both the console (`[getUserMedia] <name> <message>`) and the on-screen alert (`Camera/microphone error: <name>`).

## Verification

- `npx eslint src/hooks/useWebRTC.js src/components/GlobalCallListener.jsx` → exactly the pre-existing baseline: 25 problems (23 errors, 2 warnings), none from these edits.
- `npm run build` → passes (3.56s).
