# Chat media: no auto-download for new incoming media only

Task source: `docs/claudehelp.md`. Implemented + verified. Field names follow the actual DB schema (`from_user` / `media_type` / `media_url` / `myId`), not the generic ones in the brief.

## Task 1 — Real-time handler location
- **INSERT handler:** `Chat.jsx:792` — `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ...)` plus the appends to both render sources:
  - `messages`: `Chat.jsx:799` — `const next = [...withoutTemp, msg]`
  - `groupedMessages`: `Chat.jsx:822` — `imageGroupingService.appendMessage(...)`

## Task 2 — `_pendingLoad` flag on incoming media (INSERT handler)
In `Chat.jsx:793–797`:
```js
const isIncoming = msg.from_user !== myId
const hasMedia   = !!msg.media_url && (msg.media_type === 'image' || msg.media_type === 'video')
const pendingMsg = isIncoming && hasMedia ? { ...msg, _pendingLoad: true } : msg
```
The tagged `pendingMsg` is used in **both** the `messages` (`:801`) and `groupedMessages` (`:822`) appends, so this is only a client-only flag (never persisted). Already-loaded history and outgoing messages are not tagged.

## Task 3 — Placeholder rendered for `_pendingLoad`
Added a branch at the top of `renderMedia` (`Chat.jsx:2226–2246`) that replaces the media with a placeholder for both image and video:
```jsx
if (msg._pendingLoad) {
  const isVideo = msg.media_type === 'video'
  return (
    <div className="chat-media-placeholder" onClick={e => {
      e.stopPropagation()
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, _pendingLoad: false } : m)))
      setGroupedMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, _pendingLoad: false } : m)))
    }}>
      <div className="chat-media-placeholder-inner">
        {isVideo ? <Video size={28}/> : <ImageIcon size={28}/>}
        <span>Tap to load {isVideo ? 'video' : 'photo'}</span>
      </div>
    </div>
  )
}
```
Tap clears the flag in both `messages` and `groupedMessages` (both are render sources), revealing the real `img`/`video`.

## Task 4 — Placeholder CSS
Added to `src/styles/chat-thread.css` (`Chat.jsx` after `.media-video-wrap video`): `.chat-media-placeholder` (4/3, rounded, centered) and `.chat-media-placeholder-inner` (column, 32px icon). Uses `var(--chat-bubble-in, #f0f0f0)` / `var(--text-2, #888)`.

## Do-not-touch compliance
Existing history rendering, outgoing messages, voice/audio, and emoji-picker/input-bar changes from previous tasks were not modified.

## Deliverable answers
1. **Real-time handler:** `Chat.jsx:792` (INSERT); appends at `Chat.jsx:801` + `Chat.jsx:822`.
2. **`_pendingLoad` on incoming media:** ✓ tagged in INSERT handler, propagated to both lists.
3. **Placeholder for `_pendingLoad===true` (image + video):** ✓ `renderMedia` branch.
4. **Placeholder CSS:** ✓ added to `chat-thread.css`.
5. **Build:** `npm run build` → `✓ built in 3.89s`. Passes.