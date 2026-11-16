**Branch:** wip/chat-popup-reply (created). No code changes. Commit 5e5e53 WIP: report chat popup reply bug and diagnose sql (added sql/chat_popup_diagnose.sql, appended PROGRESS.md).

## 1) Popup component + reply handler (full)

**Component:** src/components/NotificationToast.jsx:204-479 (realtime listener + UI + reply)
- Realtime subscription builds queue from 
otifications INSERT: src/components/NotificationToast.jsx:219-248
`js
219:   useEffect(() => {
220:     let cancelled = false
221:     const channel = supabase.channel('notification-toast')
222: 
223:     supabase.auth.getUser().then(({ data: { user } }) => {
224:       if (!user || cancelled) return
225: 
226:       channel.on(
227:         'postgres_changes',
228:         {
229:           event: 'INSERT',
230:           schema: 'public',
231:           table: 'notifications',
232:           filter: user_id=eq.,
233:         },
234:         (payload) => {
235:           setQueue((prev) => [...prev, payload.new])
236:         }
237:       )
238:       channel.subscribe()
239:     })
240: 
241:     return () => {
242:       cancelled = true
243:       supabase.removeChannel(channel)
244:     }
245:   }, [])
...
252:   const actorId = visible?.data?.sender_id || visible?.data?.caller_id || visible?.data?.decliner_id || visible?.data?.voucher_id || visible?.data?.viewer_id || visible?.data?.buyer_id || visible?.data?.seller_id || visible?.data?.user_id || visible?.data?.actor_id || null
253:   const senderProfile = useSenderProfile(actorId)
`

- Reply handler (full): src/components/NotificationToast.jsx:301-317
`js
301:   async function handleSendReply() {
302:     const text = replyText.trim()
303:     if (!text || sending || !visible?.data?.sender_id) return
304:     setSending(true)
305:     const { error } = await sendMessageReply({
306:       toUserId: visible.data.sender_id,
307:       body: text,
308:       contextId: visible.data.context_id || visible.data.listing_id || null,
309:       listingTitle: visible.data.listing_title || null,
310:     })
311:     setSending(false)
312:     if (error) return
313:     setReplySent(true)
314:     clearTimeout(timerRef.current)
315:     setTimeout(dismiss, 1200)
316:   }
`

- Underlying send util: src/utils/sendMessageReply.js:24-128,130-138
`js
24: export async function sendChatMessage({
25:   toUserId,
26:   body,
27:   mediaUrl,
28:   mediaType,
29:   chatSource,
30:   contextId,
31:   senderName,
32:   contextTitle,
33:   extraFields,
34:   skipNotification,
35: }) {
...
53:   const contextFields = messageContextFields(chatSource || 'direct', contextId)
...
55:   const msgData = {
56:     from_user: user.id,
57:     to_user: toUserId,
58:     body: body || '',
59:     media_url: mediaUrl || null,
60:     media_type: mediaType || 'text',
61:     read: false,
62:     ...contextFields,
63:     ...extraFields,
64:   }
...
69:   {
70:     const res = await supabase.from('messages').insert(msgData).select('*').single()
71:     inserted = res.data
72:     error = res.error
73:   }
74:   if (error && /chat_source|shop_id|request_id|column/i.test(error.message || '')) {
75:     const legacy = { ...msgData }
76:     delete legacy.chat_source
77:         delete legacy.shop_id
78:     delete legacy.request_id
79:     const res2 = await supabase.from('messages').insert(legacy).select('*').single()
80:     inserted = res2.data
81:     error = res2.error
82:   }
...
130: export async function sendMessageReply({ toUserId, body, contextId, listingTitle }) {
131:   return sendChatMessage({
132:     toUserId,
133:     body,
134:     mediaType: 'text',
135:     contextId,
136:     contextTitle: listingTitle,
137:   })
138: }
`

## 2) How a conversation is identified

**Routes:** src/App.jsx:205-207, src/pages/ChatsLayout.jsx:12-16
`js
205:           <Route path="/chats" element={<ProtectedRoute><ChatsLayout /></ProtectedRoute>} />
206:           <Route path="/chat/:userId" element={<ProtectedRoute><ChatsLayout /></ProtectedRoute>} />
207:           <Route path="/chat/:userId/:listingId" element={<ProtectedRoute><ChatsLayout /></ProtectedRoute>} />
`
- Chat reads params/query: src/pages/Chat.jsx:213,217,237
`js
213:   const { userId, listingId: contextIdParam } = useParams()
217:   const [searchParams] = useSearchParams()
237:     resolveChatSource({ searchParams, locationState: location.state, contextId }) || 'direct'
`

**Tables:** no conversations table in app code; conversations are derived from messages rows (grouped client-side). ChatsLayout has no query/create logic. ChatListPanel loads messages (513-521).

**Columns/fields defining one conversation (grouping context):** src/utils/chatSources.js:138-170
`js
138: export function sourceFromMessage(msg) {
139:   if (!msg) return 'direct'
140:   if (msg.chat_source && CHAT_SOURCES[msg.chat_source]) return msg.chat_source
141:   if (msg.service_id) return 'service'
142: 
143:   if (msg.shop_id) return 'shop'
144:   if (msg.request_id) return 'request'
145:   if (msg.listing_id) return 'listing'
146:   return 'direct'
147: }
148: 
149: export function contextIdFromMessage(msg) {
150:   if (!msg) return null
151:   const src = sourceFromMessage(msg)
152:   switch (src) {
153:     case 'service': return msg.service_id || null
154:     case 'shop': return msg.shop_id || null
155:     case 'request': return msg.request_id || null
156:     case 'listing': return msg.listing_id || null
157:     default: return null
158:   }
159: }
...
160: /** Conversation grouping key used by the chat list. */
161: export function conversationKey(otherId, source, contextId) {
162:   const src = CHAT_SOURCES[source] ? source : 'direct'
163:   if (!contextId || src === 'direct') return dir:
164:   const prefix = {
165:     listing: 'lst',
166:     service: 'svc',
167:     shop: 'shp',
168:     request: 'req',
169:   }[src] || 'ctx'
170:   return ${prefix}::
171: }
`
- Identity = (other participant) + (source/context) where source/context come from chat_source or FKs listing_id|service_id|shop_id|request_id. Participant pair implicit via rom_user/	o_user (otherId = the other side). No conversation_id column used.

**Context fields set on insert:** src/utils/chatSources.js:104-125 (chat_source + one of listing_id|service_id|shop_id|request_id; direct => chat_source:'direct', no FK).

## 3) ChatsLayout / ChatListPanel: find/create/group (exact)

- **ChatsLayout:** layout only, mounts list/thread, no conversation find/create: src/pages/ChatsLayout.jsx:22-90 (shell + <ChatListPanel /> / <Chat />).
- **ChatListPanel — load & group:** src/pages/ChatListPanel.jsx:513-560
`js
513:   async function loadChats() {
514:     const { data: { user } } = await supabase.auth.getUser()
515:     setCurrentUser(user)
516: 
517:     const { data: messages } = await supabase
518:       .from('messages')
519:       .select('*')
520:       .or(rom_user.eq.,to_user.eq.)
521:       .order('created_at', { ascending: false })
522: 
523:     if (!messages || messages.length === 0) { setLoading(false); return }
524: 
525:     // ... Grouping strategy ...
526:     // One row per (person - context). ...
530:     const convos = new Map()
531: 
532:     for (const msg of messages) {
533:       const otherId = msg.from_user === user.id ? msg.to_user : msg.from_user
534:       const source = sourceFromMessage(msg)
535:       const contextId = contextIdFromMessage(msg)
536:       const isCallLog = !!msg.call_type
537:       const key = conversationKey(otherId, source, contextId)
538: 
539:       if (!convos.has(key)) {
540:         convos.set(key, {
541:           key,
542:           otherId,
543:           source,
544:           contextId,
545:           isService: source === 'service',
546:           isRequest: source === 'request',
547:           isShop: source === 'shop',
548:           lastMsg: msg,
549:           lastActivityAt: msg.created_at,
550:         })
551:       } else if (!isCallLog) {
552:         convos.get(key).lastMsg = convos.get(key).lastMsg || msg
553:       }
...
560:     }
`
- No “find existing or create conversation” query/function; grouping is purely in-memory by conversationKey(otherId, source, contextId) over all user messages.
- **Chat thread (normal) — filters messages by resolved source+context, no create:** src/pages/Chat.jsx:781-790,1410-1451,1561-1596,1738-1753
`js
781:   function applyContextFilter(query, source, ctxId) {
782:     if (!ctxId || source === 'direct') return query
783:     switch (source) {
784:       case 'service': return query.eq('service_id', ctxId)
785:       case 'listing': return query.eq('listing_id', ctxId)
786:       case 'shop': return query.eq('shop_id', ctxId)
787:       case 'request': return query.eq('request_id', ctxId)
788:       default: return query
789:     }
790:   }
`

## 4) Normal chat send vs popup reply — field-by-field differences

**Normal (in-thread):** src/pages/Chat.jsx:1561,1583-1596,1631-1647,1738-1753
`js
1561:   async function sendMessage(body, type = 'text', mediaUrl = null, extraFields = {}, opts = {}) {
...
1583:     const src = chatSourceRef.current || chatContextRef.current?.source || 'direct'
1584:     const ctx = chatContextRef.current?.contextId || contextId || null
1585:     const contextFields = messageContextFields(src, ctx)
1586: 
1587:     const msgData = {
1588:       from_user: user.id,
1589:       to_user: userId,
1590:       body: encodedBody || persistFields.body || '',
1591:       media_url: mediaUrl,
1592:       media_type: type,
1593:       read: false,
1594:       ...contextFields,
1595:       ...persistFields,
1596:     }
...
1631:       const res = await supabase.from('messages').insert(msgData).select('*').single()
...
1738:           await supabase.from('notifications').insert({
1739:             user_id: userId,
1740:             type: 'new_message',
1741:             title: senderName,
1742:             body: preview.slice(0, 80),
1743:             message: preview.slice(0, 80),
1744:             data: {
1745:               sender_id: user.id,
1746:               sender_name: senderName,
1747:               context_id: notifContextId,
1748:               message_id: inserted?.id || null,
1749:               chat_source: src,
1750:               listing_title: contextTitle,
1751:             },
1752:             read: false,
1753:           })
`

**Popup reply:** NotificationToast.jsx:305-310 -> sendMessageReply.js:130-138 -> sendChatMessage (sendMessageReply.js:53-64,70-81) with chatSource **undefined**, extraFields **undefined**, skipNotification **undefined**.

| Field / aspect | Normal chat (Chat.jsx:1583-1596) | Popup reply (sendMessageReply.js:53-64,130-137) | Difference |
|---|---|---|---|
| rom_user | user.id (1588) | user.id (56) | same semantics |
| 	o_user | userId from route (1589) | 	oUserId = isible.data.sender_id (306,57) | same peer for a reply |
| ody | encodedBody (reply-encoded, 1590) | ody || '' raw trimmed passed (58,133) | popup not reply-encoded (minor format) |
| media_url | mediaUrl arg (1591) | mediaUrl || null (59) | null in popup (text reply) |
| media_type | 	ype arg (1592) | mediaType || 'text' -> 'text' (60,134) | same for text |
| ead | alse (1593) | alse (61) | same |
| chat_source | messageContextFields(src,ctx) => src resolved from thread (listing|service|shop|request|direct) (1583-1585, chatSources:106-123) | messageContextFields(chatSource || 'direct', contextId) => **'direct' always** (53, no chatSource passed) | **different: popup forces direct** |
| listing_id | set when src==='listing' (chatSources:115-116) | **not set** (src becomes direct -> no FK; 113-114) | **missing/wrong for listing-context msg** |
| service_id | set when src==='service' (117-118) | **not set** | **missing/wrong** |
| shop_id | set when src==='shop' (119-120) | **not set** (and stripped on legacy retry 77) | **missing/wrong** |
| equest_id | set when src==='request' (121-122) | **not set** (stripped on legacy retry 78) | **missing/wrong** |
| extraFields / persisted extras | ...persistFields (1595; e.g. call fields, offer, etc.) | ...extraFields but **undefined** not passed (63) | popup sends no extra fields (ok for plain reply) |
| expires/default disappear | may set expires_at (1598-1600) | none | popup omits |
| conversation_id | not used | not used | none in schema/app (n/a) |
| notification data.chat_source | set to src (1749) | **omitted** (sendMessageReply.js:104-114 has no chat_source in data) | **dropped** |
| notification data.context_id | 
otifContextId (1747) | contextId || null from arg (111) | may match but context meaning lost without source |
| retry on missing cols | keeps listing_id/service_id on legacy retry (Chat.jsx:1635-1643) | deletes chat_source,shop_id,request_id (sendMessageReply.js:75-78) | differs, but root is wrong src |

**Net effect:** for a non-direct (e.g. listing/service) incoming message, popup inserts chat_source='direct' with no context FK -> sourceFromMessage/conversationKey yield dir:otherId, grouping as a separate direct chat instead of lst/svc:otherId:contextId.

## 5) Realtime listener / notification code that builds popup payload

- **Popup realtime:** listens to public.notifications INSERT for current user and passes raw row to UI: NotificationToast.jsx:226-236 (setQueue(prev => [...prev, payload.new])). No extra context derivation.
- **Popup consumes:** isible.data.sender_id (and actor fallbacks), isible.data.context_id || visible.data.listing_id, isible.data.listing_title for reply (252,305-310). **Drops:** data.chat_source (never read), data.message_id, and any typed context (does not know whether context_id is listing/service/shop/request).
- **Notification built by normal chat (source of payload):** src/pages/Chat.jsx:1738-1753 includes sender_id,sender_name,context_id,message_id,chat_source,listing_title.
- **Notification built by popup’s own send util (sendChatMessage):** src/utils/sendMessageReply.js:86-116 includes sender_id,sender_name,context_id,message_id,listing_title but **no chat_source** and no listing_id key (uses context_id only).
- **Other producers:** e.g. missed/declined call notifiers not shown to set chat_source; popup reply path is the failing send.

## 6) getOrCreateConversation helper

- **None found.** getOrCreateConversation does not exist in src/ (searched; no matches). Normal chat does **not** use such a helper either — it resolves source/context (esolveChatSource/detection, Chat.jsx:693-721), filters with pplyContextFilter/isRelevantMessage, and inserts messages with messageContextFields (Chat.jsx:781-790,1410,1583-1596). The popup bypasses thread context resolution by hardcoding chatSource || 'direct' in sendChatMessage (sendMessageReply.js:53).

## SQL (not run)

Written for review: sql/chat_popup_diagnose.sql
`sql
-- Diagnose chat popup reply creating a separate chat.
-- Lists last 20 messages with conversation/context identifiers and participant ids
-- so original message and popup reply can be compared. Do not run automatically.

select
  m.id,
  m.created_at,
  m.from_user,
  m.to_user,
  m.chat_source,
  m.listing_id,
  m.service_id,
  m.shop_id,
  m.request_id,
  m.media_type,
  m.read,
  left(m.body, 120) as body_preview
from public.messages m
order by m.created_at desc
limit 20;

-- Compare specific pair (replace :user_a, :user_b as needed):
-- select id, created_at, from_user, to_user, chat_source, listing_id, service_id, shop_id, request_id, media_type, left(body,120) as body_preview
-- from public.messages
-- where (from_user = :user_a and to_user = :user_b) or (from_user = :user_b and to_user = :user_a)
-- order by created_at desc;
`

**Stopped and waiting.**
