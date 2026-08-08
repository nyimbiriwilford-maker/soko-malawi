Fix applied and built successfully. I ran the actual test now: placed a Custom 15MB / Data Saver video call and tapped Accept on the receiver.

Result: [PASTE — did Accept work, yes/no]

Caller console (around applyLowDataIfConfigured):

[PASTE CALLER LOGS HERE]

Receiver console (from tapping Accept):

[PASTE RECEIVER LOGS HERE]

If Accept worked and you see ✅ setParameters SUCCESS appearing before the offer/ring activity — confirm this fully resolves the bug, then move to cleanup: remove the debug console.log statements added across callBudgetPrefs.js, useWebRTC.js, GlobalCallListener.jsx, useCallDataBudget.js, CallDataMeter.jsx, PersistentCallShell.jsx, FloatingIncomingCall.jsx, and confirm npm run build still passes clean afterward.

If Accept still failed, or you see ❌ setParameters FAILED in either console, proceed with the full 4-case reproduction matrix (Data Saver, Balanced, High, Standard) as laid out in your previous investigation doc, and report all four console captures.