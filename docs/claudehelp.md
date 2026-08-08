for both voice and video call, There's a design issue with the call-signal retry system. Originally, if a single call signal failed to reach the receiver, the call failed completely — so a fix was added that sends multiple signals to improve delivery odds. But now this is causing a duplicate answer problem: when the receiver successfully answers via one signal, a second signal is still being processed too, causing the caller to try applying the answer twice (setRemoteDescription called twice → InvalidStateError: Called in wrong state: stable).

What's needed: the retry/redundancy system needs a "first success wins, cancel the rest" mechanism — not "send several and let all of them run independently to completion."

Please implement it properly:

Find where call signals are currently being sent multiple times (likely duplicated sendSignal() calls, multiple channels, or a retry loop without cancellation) — both for the outgoing offer/ring and the incoming answer.
Add a guard so that once a signal is successfully delivered and acknowledged/processed (e.g. the receiver picks up, or the caller successfully applies an answer), any other in-flight or pending duplicate signals for that same call are ignored/discarded — not processed a second time.
Concretely for the answer flow specifically: once the caller successfully calls setRemoteDescription() with the first answer signal received, any subsequent "answer" signal for the same callId should be detected and skipped entirely (check callId + a "already answered" flag) before even attempting setRemoteDescription() again — don't rely on the try/catch error swallowing this, actually prevent the duplicate call.
Keep the original resilience goal intact: if the first signal attempt genuinely fails to reach the receiver (timeout, no ack, etc.), the next signal attempt should still fire as a fallback — so a call doesn't fail outright just because one delivery attempt was lost. The fix is about eliminating redundant processing of successful duplicates, not about removing the retry safety net entirely.
Apply the same "first success wins" logic to both directions — offer delivery (caller → receiver) and answer delivery (receiver → caller) — since both currently seem to use this multi-signal approach.

Rebuild and I'll retest to confirm no duplicate "answer" processing occurs and the call still connects reliably.