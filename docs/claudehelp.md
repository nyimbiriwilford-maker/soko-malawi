Investigate and permanently fix two issues in the SokoMw project by identifying the root cause before making changes.

1. Notification Popup:
- The notification popup does not disappear after a few seconds as expected.
- Trace the entire notification lifecycle (creation, state management, rendering, auto-dismiss timer, cleanup, subscriptions).
- Check for duplicate listeners, missing cleanup, stale timers, React StrictMode double execution, duplicate realtime subscriptions, or notification queue issues.
- Ensure each notification appears once, auto-dismisses after the configured duration, is removed from state, and all timers/listeners are properly cleaned up.

2. Incoming Video Call Popup:
- When an incoming video call is answered, the video call starts correctly, but another incoming call popup immediately appears.
- Trace the complete call flow from incoming event to connected state.
- Investigate all call-related contexts, hooks, providers, realtime subscriptions, websocket listeners, and state transitions.
- Check for duplicate event listeners, multiple subscriptions, race conditions, incomingCall state not being cleared, call status not updating, or answered calls still being treated as ringing.
- Once a call is accepted, immediately clear the incoming popup state and prevent any further incoming popup while the call is connecting or connected. Implement a proper call state machine if necessary so the active call is the single source of truth.

Search the entire codebase for all related notification and video call logic, identify the actual root causes, implement clean production-ready fixes (not hacks or temporary workarounds), remove duplicate listeners if found, and provide a report explaining the root causes, files modified, and why the fixes are permanent.