Task: Debug console.log cleanup (pre-Vercel-push cleanup)

Strip all debug console.log statements added during the recent call-system debugging session from these 8 files:

src/lib/callBudgetPrefs.js
src/hooks/useWebRTC.js
src/components/GlobalCallListener.jsx
src/hooks/useCallDataBudget.js
src/components/CallDataMeter.jsx
src/components/PersistentCallShell.jsx
src/components/CallContext.jsx
src/components/FloatingIncomingCall.jsx

Guidelines:

Remove debug tracing logs — things like [applyLowDataIfConfigured] CALLED, [getLearnedRates] Full usage log:, [FloatingIncomingCall] Accept tapped, [answerWithOffer] step-by-step tracing, [CallDataBudget] bytesUsed: per-sample logging.
Do NOT remove pre-existing console.error/console.warn that were part of legitimate error handling before this debugging session. If unsure whether a log predates this session, leave it and flag for review rather than guessing.
Don't touch any logic/fixes — only remove logging statements.
After cleanup, run npm run build and npx eslint on the touched files, confirm clean, report a summary of how many log lines removed per file.

This is the last blocker before the Vercel push — do this one task, then stop and report back (don't move to the backfill or anything else without checking in first).