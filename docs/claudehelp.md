Two quick fixes before Phase 6. No other changes.

FIX 1 — Remove unused imageUploadProgresses state (lint error):
Find: const [imageUploadProgresses, setImageUploadProgresses] = useState({})
Replace with: (delete the line entirely)

Then find every call to setImageUploadProgresses in the file and delete those lines too (there should be 2-3: one in uploadQueue setting initial zeros, one in uploadSingleImage updating per-index, one in uploadQueue resetting to {}). Progress is already tracked in the pending group's _imageGroup[i]._uploadProgress — this state is redundant.

FIX 2 — Prevent pending group from blinking off on first realtime echo:
In the realtime INSERT handler (setupRealtimeChannel), find the setMessages block that rebuilds groupedMessages:

setMessages(prev => {
  const withoutTemp = prev.filter(m => {
    if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
    if (m.id === msg.id) return false
    return true
  })
  const next = [...withoutTemp, msg]
  setGroupedMessages(imageGroupingService.groupMessages(next))
  return next
})

Replace with:

setMessages(prev => {
  const withoutTemp = prev.filter(m => {
    if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
    if (m.id === msg.id) return false
    return true
  })
  const next = [...withoutTemp, msg]
  if (!pendingGroupIdRef.current) {
    setGroupedMessages(imageGroupingService.groupMessages(next))
  }
  return next
})

This skips the groupedMessages rebuild while a multi-image upload is in flight — the pending group stays visible with its per-image progress bars. Once all uploads finish, uploadQueue removes the pending group and clears pendingGroupIdRef.current, after which the next realtime echo triggers a normal rebuild. Add one final rebuild after the pending group is removed in uploadQueue:

Find in uploadQueue (the multi-image path), after:
setGroupedMessages(prev => prev.filter(m => m.id !== pendingId))
pendingGroupIdRef.current = null

Add immediately after those two lines:
setGroupedMessages(imageGroupingService.groupMessages(messages))

Note: `messages` here refers to the React state variable — confirm it is in scope inside uploadQueue (it should be via closure). If ESLint warns about it as a dependency, that is acceptable and pre-existing.

Run npx eslint src/pages/Chat.jsx and npm run build. Confirm:
- Lint error count is back to 13 (9 errors, 4 warnings)
- Build passes
- grep for imageUploadProgresses returns no results in Chat.jsx