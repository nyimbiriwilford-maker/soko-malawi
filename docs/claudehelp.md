Instructions for DeepSeek:

Instructions for DeepSeek — Chat: Paginated Message Loading (Infinite Scroll Upward)

Goal: Instead of loading all messages at once, load only the most recent N messages on open. When the user scrolls up to the top, load the previous page — little by little, not all at once.

Task 1 — Read only, find current message loading

In Chat.jsx, find:

The initial message fetch (likely a useEffect that queries Supabase for all messages in the thread)
How messages are stored in state (setMessages)
The scroll container ref (the div that wraps the messages list)
The current query — does it have any limit, range, or order clause?

Report exact line numbers. Do not change anything yet.

Task 2 — Add pagination state

Near the top of the component, add these state/ref variables:

js
const PAGE_SIZE = 20  // messages per page — constant, not state
const [hasMore, setHasMore] = useState(true)
const [loadingMore, setLoadingMore] = useState(false)
const oldestLoadedIdRef = useRef(null)  // tracks the oldest message id loaded so far
const scrollContainerRef = useRef(null) // if not already present
Task 3 — Modify the initial fetch to load only the last 20 messages

Find the initial Supabase query for messages. Change it to fetch only the last PAGE_SIZE messages, ordered by created_at descending, then reverse for display:

js
// BEFORE (example — match actual query)
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('thread_id', threadId)
  .order('created_at', { ascending: true })

// AFTER
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('thread_id', threadId)
  .order('created_at', { ascending: false })
  .limit(PAGE_SIZE)

const messages = (data || []).reverse()  // oldest → newest for display

if (messages.length < PAGE_SIZE) setHasMore(false)
if (messages.length > 0) oldestLoadedIdRef.current = messages[0].id
Task 4 — Add a loadMoreMessages function
js
const loadMoreMessages = useCallback(async () => {
  if (loadingMore || !hasMore) return
  setLoadingMore(true)

  // Get the created_at of the oldest message currently loaded
  const oldest = messages.find(m => m.id === oldestLoadedIdRef.current)
  if (!oldest) { setLoadingMore(false); return }

  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .lt('created_at', oldest.created_at)   // older than current oldest
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  const older = (data || []).reverse()

  if (older.length < PAGE_SIZE) setHasMore(false)
  if (older.length > 0) {
    oldestLoadedIdRef.current = older[0].id
    setMessages(prev => [...older, ...prev])  // prepend older messages
  }

  setLoadingMore(false)
}, [loadingMore, hasMore, messages, threadId])
Task 5 — Trigger loadMoreMessages on scroll to top

On the scroll container, add a scroll handler:

js
const handleScroll = useCallback(() => {
  const el = scrollContainerRef.current
  if (!el) return
  // When user is within 80px of the top, load more
  if (el.scrollTop <= 80 && hasMore && !loadingMore) {
    loadMoreMessages()
  }
}, [hasMore, loadingMore, loadMoreMessages])

Wire it to the scroll container:

jsx
<div ref={scrollContainerRef} onScroll={handleScroll} className="chat-messages-list">
Task 6 — Preserve scroll position when prepending messages

When older messages are prepended, the scroll position jumps to the top. Fix this:

js
// In loadMoreMessages, before setMessages:
const el = scrollContainerRef.current
const prevScrollHeight = el ? el.scrollHeight : 0

// After setMessages, in a useEffect or directly:
requestAnimationFrame(() => {
  if (el) {
    el.scrollTop = el.scrollHeight - prevScrollHeight
  }
})
Task 7 — Show a loading indicator at the top

At the top of the messages list JSX, add:

jsx
{loadingMore && (
  <div className="chat-load-more-spinner">
    <span>Loading...</span>
  </div>
)}
{!hasMore && messages.length > 0 && (
  <div className="chat-load-more-end">
    <span>No more messages</span>
  </div>
)}

In chat-thread.css:

css
.chat-load-more-spinner,
.chat-load-more-end {
  text-align: center;
  padding: 10px;
  font-size: 12px;
  color: var(--text-2, #888);
}
Do NOT touch
Real-time INSERT handler — new messages still append to the bottom normally
_pendingLoad media placeholder logic
Emoji picker or input bar changes
imageGroupingService — it still receives messages the same way; just feed it the paginated array
Deliverable

Report back with:

Current fetch location and query (Task 1)
Confirm PAGE_SIZE, hasMore, loadingMore, oldestLoadedIdRef added
Confirm initial fetch now loads last 20 only
Confirm loadMoreMessages function added
Confirm scroll handler wired to container
Confirm scroll position preserved on prepend
Confirm loading indicator added
Build passes