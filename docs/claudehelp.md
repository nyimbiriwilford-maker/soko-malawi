Instructions for DeepSeek — Chat Media Placeholder: Fix Grouped Images + Confirm Root Cause

Situation: The flag and render path are correct for single images. The confirmed gap is grouped images — asGroup spreads group[0] (the anchor) as the bubble, so if the newest flagged image is a group member (not the anchor), _pendingLoad never reaches the bubble. Fix both paths.

Task 1 — Read the console logs first

Before changing anything, send a new incoming image/video in the chat and read the browser console. Report:

Does [media-debug] show _pendingLoad: true?
Does [renderMedia] show _pendingLoad: true or undefined for that message?

This tells us whether the bug is the grouping path or something else entirely.

Task 2 — Fix grouped images in imageGroupingService.js

In asGroup, the anchor (group[0]) is spread as the bubble. If any message in the group has _pendingLoad: true, the whole group bubble must show the placeholder.

js
// BEFORE
function asGroup(group) {
  return { ...group[0], _imageGroup: group, _isGroup: true }
}

// AFTER
function asGroup(group) {
  const anyPending = group.some(m => m._pendingLoad)
  return { ...group[0], _imageGroup: group, _isGroup: true, _pendingLoad: anyPending }
}
Task 3 — Fix the placeholder tap for grouped images

When the user taps the placeholder on a grouped bubble, clear _pendingLoad on all messages in the group, not just the anchor:

jsx
// In renderMedia, inside the _pendingLoad branch onClick:

onClick={e => {
  e.stopPropagation()
  // Get all IDs to clear — single message or all in group
  const idsToClear = msg._isGroup
    ? new Set(msg._imageGroup.map(m => m.id))
    : new Set([msg.id])

  setMessages(prev =>
    prev.map(m => idsToClear.has(m.id) ? { ...m, _pendingLoad: false } : m)
  )
  setGroupedMessages(prev =>
    prev.map(m => {
      if (idsToClear.has(m.id)) return { ...m, _pendingLoad: false }
      if (m._isGroup && m._imageGroup?.some(g => idsToClear.has(g.id))) {
        return {
          ...m,
          _pendingLoad: false,
          _imageGroup: m._imageGroup.map(g => idsToClear.has(g.id) ? { ...g, _pendingLoad: false } : g)
        }
      }
      return m
    })
  )
}}
Task 4 — Remove the temporary console logs

Remove both logs added in the previous debug task:

Chat.jsx — the [media-debug] log in the INSERT handler
Chat.jsx — the [renderMedia] log at the top of renderMedia
Deliverable

Report back with:

Console log output from Task 1 (before any changes)
Confirm asGroup fix applied in imageGroupingService.js
Confirm grouped tap clears all group members
Confirm both console logs removed
Build passes