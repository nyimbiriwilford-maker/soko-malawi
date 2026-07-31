This addresses the root cause found in the Task 6 investigation: on phones, tapping the OS push notification's Answer action triggers a hard page reload (window.location.href in App.jsx's onAnswer), which wipes GlobalCallListener's in-memory call-stack ownership mid-answer. sessionStorage.__pendingCall survives the reload, so the freshly-mounted chat stack's restorePendingCall claims the call instead — even though GlobalCallListener may have already started answering it in-app. This also likely explains the recurring setRemoteDescription ... wrong state: stable error we've seen throughout testing (two answer attempts racing).

Implementing fix direction #1 from the investigation report:

In GlobalCallListener.jsx's answerWithOffer, confirm claimCallStack?.('global') and sessionStorage writes for __globalCallActive happen synchronously, before any await (the report says this is already the case at lines 294-297 — verify, don't assume).
In App.jsx's onAnswer handler (the one currently doing window.location.href = url), before navigating, check whether an in-app answer is already in flight:
js
   const globalActive = sessionStorage.getItem('__globalCallActive')
   if (globalActive === <the callId from this notification>) {
     // GlobalCallListener is already answering this call in-app — don't steal it.
     return
   }

Only proceed with window.location.href = url if there's no matching in-flight global answer.

Add a mount-time restore for __globalCallActive in GlobalCallListener.jsx (the report notes this key is currently written/removed but never read on mount) — so that if the component remounts for any reason mid-call, it can recognize it already owns an active call rather than leaving the flag orphaned.
Make sure __globalCallActive is reliably cleared in all teardown paths (cleanupCall(), and existing endCallLocally() equivalent) so it never gets stuck set after a call ends, which would incorrectly block future SW navigation.

Do not touch: the budget/bitrate-cap logic, useWebRTC.js's chat-stack behavior for calls answered normally through the chat UI, or any UI copy.

Verification requested:

npx eslint / npm run build clean.
Explain the exact synchronous-vs-async ordering you verified in step 1, quoting the real current code.
Report any edge cases you're not fully confident are covered (e.g. what happens if the in-app answer itself fails after claiming — does the flag get cleared so the notification path can still work as a fallback?).