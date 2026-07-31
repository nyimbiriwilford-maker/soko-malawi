Task 11 — Surface the real getUserMedia error (diagnostic only)

Problem: Ethel gets "microphone/camera access denied" after tapping the call button, despite Chrome site settings showing Camera/Microphone = Allow. Need to see the actual browser error (error.name) to diagnose — could be NotAllowedError (real permission issue), NotReadableError (device already in use by another app/tab), OverconstrainedError, or something else entirely being mislabeled by a generic catch block.

Do not touch: any permission-request logic, CallBudgetSelector.jsx, callBitrateCap.js, useCallDataBudget.js. This task only adds visibility, no behavior change.

Investigate and report first:

Find every getUserMedia call site in useWebRTC.js and GlobalCallListener.jsx — paste the surrounding try/catch verbatim.
Show exactly how the catch block currently produces the "access denied" message shown to the user — is it a generic message regardless of error.name, or does it already branch on error type?

Fix:

In the catch block(s), log error.name and error.message to console (e.g. console.error('[getUserMedia]', err.name, err.message)).
Update the user-facing error message to include the error name, e.g. Camera/microphone error: ${err.name} instead of (or alongside) the generic "access denied" text — so the real cause is visible without needing DevTools.

Verify: npm run build passes. Report both call sites' updated catch blocks.