Phase 6 — Real-time update optimisation. No styling changes.

Objective: when a new message arrives via realtime INSERT, append it intelligently instead of rebuilding the whole grouped message list. Preserve scroll position, prevent flickering, minimise re-renders.

═══════════════════════════════════
CURRENT STATE (confirm before fixing)
═══════════════════════════════════

Show the full realtime INSERT handler in setupRealtimeChannel as it stands after Phase 5 fixes — specifically the setMessages block and what it does to groupedMessages.

═══════════════════════════════════
FIX — Optimised realtime INSERT
═══════════════════════════════════

The INSERT handler currently does a full imageGroupingService.groupMessages(next) rebuild on every incoming message. Replace it with an incremental appendMessage call for the common case, falling back to full rebuild only when necessary.

In the realtime INSERT handler, replace the full setMessages block with:

setMessages(prev => {
  const withoutTemp = prev.filter(m => {
    if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
    if (m.id === msg.id) return false
    return true
  })
  const next = [...withoutTemp, msg]

  if (!pendingGroupIdRef.current) {
    // Incremental append — fast path for the common case
    // appendMessage handles grouping rules (same sender, within 60s, image type)
    setGroupedMessages(prev => imageGroupingService.appendMessage(prev, { ...msg, _status: undefined }))
  }

  return next
})

Also: the temp_ optimistic bubble was already appended to groupedMessages in sendMessage. The appendMessage call above adds the real message. But the temp_ row is still in groupedMessages (it was appended as an optimistic bubble). We need to strip it before appending the real message.

Replace the setGroupedMessages line above with:

setGroupedMessages(prev => {
  const withoutOptimistic = prev.filter(m =>
    !(String(m.id).startsWith('temp_') &&
      m.from_user === msg.from_user &&
      m.media_type === msg.media_type)
  )
  return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
})

This means:
- Common case (new message, no multi-upload in flight): strip optimistic temp, append real message incrementally — O(1) instead of O(n)
- Multi-upload in flight (pendingGroupIdRef.current set): skip groupedMessages update entirely — pending group stays visible
- UPDATE/DELETE: still do full rebuild (rare, correct)

═══════════════════════════════════
SCROLL POSITION PRESERVATION
═══════════════════════════════════

Show the current scroll-to-bottom logic in Chat.jsx — how and when it scrolls after new messages arrive (look for scrollIntoView, scrollTop, nearBottomRef, or similar). 

If scroll-to-bottom only fires when nearBottomRef.current is true (user is near bottom), confirm this is already the case — appendMessage does not change scroll behaviour since it only updates state, not the DOM directly. If scroll fires unconditionally on every message, that is the flickering source and needs to be guarded by nearBottomRef.

Report what you find and whether scroll already respects nearBottomRef before applying any scroll changes.

═══════════════════════════════════
RE-RENDER MINIMISATION
═══════════════════════════════════

Wrap the renderMedia function in useCallback so it does not recreate on every render:

Find: function renderMedia(msg, caption) {
Replace: const renderMedia = useCallback(function renderMedia(msg, caption) {

Find the closing } of renderMedia (the function ends before the next top-level function) and add after it:
, [lightbox, setLightbox, playingId, audioProgress, audioDuration, audioRefs, currentUser, setGroupedMessages, pendingGroupIdRef])

Note: if useCallback is not already imported from React, add it to the React import.

Run npx eslint src/pages/Chat.jsx and npm run build. Report both. Confirm:
- grep -n "groupMessages\|appendMessage" src/pages/Chat.jsx — show all call sites
- INSERT handler now uses appendMessage (not groupMessages)
- UPDATE and DELETE still use groupMessages
- Build passes, lint no new errors