**Branch:** wip/chat-popup-reply (no merge, no push). Commits: 82ad3a7 (step 1), 6f8681d (step 2), 9bb3e34 (step 3), b09e48c (step 4).

## Step 1 - src/utils/sendMessageReply.js
- sendMessageReply({ toUserId, body, contextId, chatSource, listingTitle }) now accepts chatSource and passes it to sendChatMessage.
- sendChatMessage notification data includes chat_source: chatSource || 'direct' (plus typed context now, see step 3).
- Legacy retry only strips chat_source/shop_id/request_id when the error message names that column; listing_id and service_id are never stripped.

## Step 2 - src/components/NotificationToast.jsx handleSendReply
- Passes chatSource from visible.data.chat_source and contextId from visible.data.context_id || visible.data.listing_id.
- If chat_source is missing: looks up messages by visible.data.message_id, derives source/context with sourceFromMessage/contextIdFromMessage; else latest message between the pair (either direction); only if no message exists falls back to 'direct'.

## Step 3 - new_message producers
- src/pages/Chat.jsx:1738-1753 (had chat_source; added typed context via messageContextFields).
- src/utils/forwardMessage.js:144-159 (had chat_source; added typed context via messageContextFields).
- src/utils/sendMessageReply.js:91-106 (had chat_source; added typed context via contextFields).
- No other type 'new_message' producers in src/ or supabase/functions (offer_new/offer_counter, wanted_alert, missed_call/missed_video use other types; untouched).

## Step 4 - PROGRESS.md
- Added src/utils/sendMessageReply.test-note line (38). No test files added.

## RAW: npm run build
`
dist/assets/Notifications-BOQAXAvk.js                     72.47 kB │ gzip: 19.73 kB
dist/assets/verification-CpAl-AwZ.js                      81.74 kB │ gzip: 22.12 kB
dist/assets/ListingDetail-BxOGMstA.js                     81.83 kB │ gzip: 19.62 kB
dist/assets/SearchPage-C95R2JdV.js                        95.90 kB │ gzip: 21.17 kB
dist/assets/ShopPage-DmQFso3B.js                         132.59 kB │ gzip: 28.44 kB
dist/assets/vendor-react-CNSGFAJv.js                     178.26 kB │ gzip: 55.95 kB
dist/assets/ChatsLayout-BErV_SRg.js                      181.76 kB │ gzip: 51.45 kB
dist/assets/vendor-supabase-niU8KDh3.js                  193.55 kB │ gzip: 49.62 kB
dist/assets/Admin-BgIGMqUt.js                            198.19 kB │ gzip: 44.41 kB
dist/assets/vendor-Uo_LcHLI.js                           221.52 kB │ gzip: 73.89 kB
dist/assets/index-Bps8kSwH.js                            228.70 kB │ gzip: 66.32 kB
dist/assets/Home-P_k7XATX.js                             229.52 kB │ gzip: 52.04 kB
dist/assets/Profile-DFAAZkOi.js                          458.54 kB │ gzip: 78.51 kB

✓ built in 2.70s
`

## RAW: npx eslint src/components/NotificationToast.jsx src/utils/sendMessageReply.js | Select-String "no-undef"
`
(no output)
`

## RAW: git diff --stat
`
 dist/index.html     |   2 +-
 docs/response.dm    | 369 ++++++----------------------------------------------
 public/version.json |   2 +-
 3 files changed, 40 insertions(+), 333 deletions(-)
`
(Build artifacts only: dist/index.html, public/version.json; docs/response.dm is this report. All source edits are committed.)
