Kimi K3 was assigned the debug console.log cleanup task but is failing repeatedly with a "Response contained no choices" error before doing any work — switching this task to you instead.

Task: strip debug console.log statements added during this session from:

src/lib/callBudgetPrefs.js
src/hooks/useWebRTC.js
src/components/GlobalCallListener.jsx
src/hooks/useCallDataBudget.js
src/components/CallDataMeter.jsx
src/components/PersistentCallShell.jsx
src/components/CallContext.jsx
src/components/FloatingIncomingCall.jsx

Remove debug tracing logs (things like [applyLowDataIfConfigured] CALLED, [getLearnedRates] Full usage log:, [FloatingIncomingCall] Accept tapped, [answerWithOffer] step tracing, [CallDataBudget] bytesUsed: per-sample logs). Do NOT remove pre-existing console.error/console.warn that were part of legitimate error handling before this session — if unsure whether a log predates this session, leave it and flag for review.

Don't touch any logic — only remove logging. After cleanup, run npm run build and npx eslint on the touched files, confirm clean, and report a summary of how many lines removed per file.

Separately, since this is the second Kimi failure in a row on this same task, I'd deprioritize Kimi for now rather than keep retrying — it may be having a genuine connectivity/integration issue tonight that isn't worth losing more time to.