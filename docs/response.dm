Branch: wip/chat-quick-replies (no merge, no push). Commits: ba3aa92 (step 1), ebbabe2 (step 2), f97217f (step 3).

REPORT (pre-change, file + line)
1. Quick replies were a hardcoded listing array rendered at src/pages/Chat.jsx:3373-3384. Only render condition: messages.length === 0 && !isServiceChat (src/pages/Chat.jsx:3366). No source switch, so an empty request chat showed the listing lines.
2. Chat source: useState init src/pages/Chat.jsx:236-238 calls resolveChatSource({searchParams, locationState, contextId}) || 'direct'; chatSourceRef 240, chatContextRef 310; refs updated at 406-407 and 718-719; source resolved in init 692-720. Request id = contextId from route param named listingId (213-214) when source is 'request'; used in applyContextFilter 787 (request_id) and send path 1583-1585.
3. Ownership: buyer_requests.user_id exists (used at src/pages/Profile.jsx:1107). Chat already loads the whole row: loadContextEntity src/pages/Chat.jsx:769-774 does supabase.from('buyer_requests').select('*').eq('id', id).maybeSingle() and setRequest(data) (state at 235), so request.user_id is available without a new query. If it were not loaded, cheapest safe read: select('id, user_id') for that request id.

STEP 1
Added requestSellerQuickReplies and requestBuyerQuickReplies; selection in activeQuickReplies returns request sets when chatSourceRef/chatSource is 'request' (never listing lines). Listing/service/shop/direct keep the same array.

STEP 2
Role guard: in request chats, if request.user_id or currentUser.id is missing, activeQuickReplies returns [] (no quick replies). Otherwise owner === currentUser -> buyer set, else seller set. Failed lookup shows none.

STEP 3
Tap behavior unchanged: onClick still setNewMsg(q) + focus; sends still go through existing sendMessage, so chat_source='request' and request_id stay set. No sending logic changed.

RAW: npm run build
dist/assets/vendor-supabase-niU8KDh3.js                  193.55 kB | gzip: 49.62 kB
dist/assets/Admin-B-rvgvoZ.js                            198.19 kB | gzip: 44.41 kB
dist/assets/vendor-Uo_LcHLI.js                           221.52 kB | gzip: 73.89 kB
dist/assets/index-CfmrIWxb.js                            228.70 kB | gzip: 66.31 kB
dist/assets/Home-DZwsS3QB.js                             229.52 kB | gzip: 52.04 kB
dist/assets/Profile-DCujwtrk.js                          458.54 kB | gzip: 78.51 kB

built in 2.75s

RAW: npx eslint src/pages/Chat.jsx | Select-String "no-undef"
(no output)

RAW: git diff master --stat -- src
 src/pages/Chat.jsx | 53 +++++++++++++++++++++++++++++++++++++++++------------
 1 file changed, 41 insertions(+), 12 deletions(-)
