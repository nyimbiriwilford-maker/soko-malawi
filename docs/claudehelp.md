Instructions for DeepSeek — Chat Media: No Auto-Download for New Incoming Media Only

Clarification: Only apply the click-to-load placeholder to newly received incoming media messages — media that arrives via real-time subscription after the chat is open. Already-loaded media in the existing message history stays as-is.

Task 1 — Read only, find the real-time message handler

In Chat.jsx, find the Supabase real-time subscription that receives new incoming messages (likely postgres_changes or channel.on('INSERT', ...)). Report the exact line number and the handler function name/body. Do not change anything yet.

Also find where new messages are appended to the messages list state (e.g. setMessages(prev => [...prev, newMsg])).

Task 2 — Tag new incoming media messages

When a new message arrives via the real-time handler and it contains media (type === 'image' or type === 'video' or media_url is set), tag it so the UI knows to show a placeholder instead of auto-loading.

js
// Inside the real-time INSERT handler, when appending the new message:

// BEFORE
setMessages(prev => [...prev, newMsg])

// AFTER
const isIncoming = newMsg.sender_id !== currentUserId
const hasMedia = newMsg.media_url || newMsg.type === 'image' || newMsg.type === 'video'

setMessages(prev => [...prev, {
  ...newMsg,
  _pendingLoad: isIncoming && hasMedia   // true = show placeholder, false = load normally
}])

_pendingLoad is a client-only flag — it is never sent to the database.

Task 3 — Render placeholder for _pendingLoad messages

Find where media messages are rendered in the message bubble. Add a branch on _pendingLoad:

Images:

jsx
// BEFORE
<img src={msg.media_url} className="chat-media-img" />

// AFTER
{msg._pendingLoad ? (
  <div
    className="chat-media-placeholder"
    onClick={() => setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, _pendingLoad: false } : m)
    )}
  >
    <div className="chat-media-placeholder-inner">
      {Icon.image()}
      <span>Tap to load photo</span>
    </div>
  </div>
) : (
  <img src={msg.media_url} className="chat-media-img" />
)}

Videos:

jsx
{msg._pendingLoad ? (
  <div
    className="chat-media-placeholder"
    onClick={() => setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, _pendingLoad: false } : m)
    )}
  >
    <div className="chat-media-placeholder-inner">
      {Icon.video()}
      <span>Tap to load video</span>
    </div>
  </div>
) : (
  <video src={msg.media_url} controls preload="none" className="chat-media-video" />
)}
Task 4 — Style the placeholder in chat-thread.css
css
.chat-media-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--chat-bubble-in, #f0f0f0);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 120px;
}

.chat-media-placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-2, #888);
  font-size: 13px;
}

.chat-media-placeholder-inner svg {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}
Do NOT touch
Existing message history rendering — no placeholders on already-loaded messages
Outgoing messages — sender sees their own media load normally
Voice/audio messages
Any emoji picker or input bar changes from previous tasks
Deliverable

Report back with:

Real-time handler location (file + line number)
Confirm _pendingLoad flag added on incoming media in the INSERT handler
Confirm placeholder rendered for _pendingLoad === true for both image and video
Confirm placeholder CSS added to chat-thread.css
Build passes