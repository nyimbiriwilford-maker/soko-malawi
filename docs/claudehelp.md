Phase 3 completion — integrate ImageGroupingService fully. Two targeted fixes only, no styling changes, no regressions.

Investigation first, then fix:

1. Confirm the variable name: the useMemo at Chat.jsx:1368 assigns to `groupedMessages` — but the render loop at line 2442 iterates `groupedImages`. Are these the same variable (renamed somewhere between), or is the render loop reading a different/stale array? Show the exact line where the render loop's source variable is defined.

2. In the realtime INSERT handler (setupRealtimeChannel, around line 607), show the exact code that appends a new message to the `messages` state. Does it call setMessages(prev => [...prev, msg]) or similar?

Then apply:

FIX A — Wire appendMessage for real-time image grouping:
The realtime handler currently calls setMessages(prev => [...prev, msg]) which causes the useMemo to re-run groupMessages() on the full array every time. Instead:

- Add a second state: const [groupedMessages, setGroupedMessages] = useState([])
- Remove the useMemo that computes groupedMessages from messages
- When messages are initially loaded (loadMessages), set both:
  setMessages(loaded)
  setGroupedMessages(imageGroupingService.groupMessages(loaded))
- In the realtime INSERT handler, after adding to messages, also do:
  setGroupedMessages(prev => imageGroupingService.appendMessage(prev, msg))
- For UPDATE and DELETE handlers, rebuild from full messages (these are rare):
  setGroupedMessages(imageGroupingService.groupMessages(updatedMessages))

FIX B — Fix the variable name:
If the render loop reads groupedImages but the computed variable is groupedMessages, rename the render loop's source to groupedMessages consistently throughout Chat.jsx (find all references to groupedImages and replace with groupedMessages). If they're already the same variable, report that and skip this fix.

After both fixes:
- Confirm appendMessage is now called on every realtime INSERT
- Confirm groupMessages is only called on initial load and on UPDATE/DELETE (not on every new message)
- Run npx eslint src/pages/Chat.jsx and npm run build — report results
- grep -n "groupedImages\|groupedMessages" src/pages/Chat.jsx and paste the result