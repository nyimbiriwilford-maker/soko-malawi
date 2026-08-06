Phase 7 — Edge case handling. No styling changes.

Objective: ensure image grouping stays correct under all failure and edge conditions.

═══════════════════════════════════
INVESTIGATION FIRST
═══════════════════════════════════

Show:
1. How loadMessages handles pagination/infinite scroll — does it append older messages to the front of the messages array, or replace the whole array? Show the relevant code.
2. Is there any offline detection or sync logic in Chat.jsx — any navigator.onLine check, online/offline event listeners, or queue for messages sent while offline?
3. How does the delete-message flow work — specifically deleteMessageForMe and the server-side delete (deleteMessageForEveryone or similar). Does it update messages state directly, or only via realtime DELETE echo?
4. How does failed upload retry work currently — is there a retry button on failed bubbles? Show the _status: 'failed' bubble rendering and any retry handler.

═══════════════════════════════════
FIXES
═══════════════════════════════════

FIX A — Out-of-order and paginated messages (prepend older messages):

When loadMessages appends older messages to the FRONT of the array (pagination/infinite scroll), groupedMessages must be rebuilt from the full combined array, not just appended. Find where older messages are prepended to messages state and ensure groupedMessages is rebuilt:

After any setMessages call that prepends older messages (not the initial load, not realtime appends — only the pagination prepend), add:
setGroupedMessages(prev => imageGroupingService.groupMessages([...olderMessages, ...currentMessages]))

If no pagination exists yet, add a comment: // TODO Phase 7: rebuild groupedMessages when older messages are prepended

FIX B — Duplicate realtime events:

The INSERT handler already deduplicates by id (if (m.id === msg.id) return false in the messages filter). Confirm appendMessage in imageGroupingService.js also handles duplicates safely — it calls appendMessage which adds to the end, so a duplicate id would create a second bubble.

Add deduplication to the groupedMessages INSERT path. In the realtime INSERT handler, inside the setGroupedMessages updater, add a duplicate check before calling appendMessage:

setGroupedMessages(prev => {
  // Deduplicate: if this message id already exists in grouped, skip
  const alreadyExists = prev.some(m => {
    if (m._isGroup) return m._imageGroup?.some(img => img.id === msg.id)
    return m.id === msg.id
  })
  if (alreadyExists) return prev

  const withoutOptimistic = prev.filter(m =>
    !(String(m.id).startsWith('temp_') &&
      m.from_user === msg.from_user &&
      m.media_type === msg.media_type)
  )
  return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
})

FIX C — Failed upload retry:

Show the _status: 'failed' bubble rendering code. If there is already a retry button that calls sendMessage again, confirm it also works for image types (media_url is preserved in _retry). If the retry path calls uploadAndSend again (re-uploads the file), that is correct — confirm _retry stores the original file reference.

If no retry exists for image uploads specifically, add a note that _retry.file may be stale (object URLs are revoked after preview closes) — do not attempt to fix file re-upload in this phase, just document it.

FIX D — Delete handling for grouped images:

The realtime DELETE handler already calls imageGroupingService.groupMessages(next) on the remaining messages — this correctly removes deleted images from groups and reflows the layout. Confirm this is the case by showing the DELETE handler.

If a deleted image was part of a group and the group now has only 1 image remaining, groupMessages will return it as a single bubble (asGroup returns asBubble for length===1). Confirm asGroup handles this correctly by checking imageGroupingService.js line for asGroup.

FIX E — App restart / session restore:

loadMessages runs on mount and calls imageGroupingService.groupMessages(data) — this already reconstructs grouping from scratch on every app start. Confirm this is the case (it should be from Phase 3). No fix needed if confirmed.

Run npx eslint src/pages/Chat.jsx src/lib/imageGroupingService.js and npm run build. Report:
- All findings from the investigation
- Which fixes were applied vs confirmed-already-working
- Lint and build results
- Any edge case that cannot be handled without schema changes or new infrastructure