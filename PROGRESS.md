1. Inspect state - Home.jsx Phase C items present (LF_WEIGHTS, urgency bonus, LF_NEAR_KM, lfNearby filters, useEffect near, options check icon, Show all Malawi); build passed
2. Continue/verify - npm run build passed; preview started (HTTP 200); no TDZ errors found in code review3. Step 1 - Card redesign LookingForRequestCard.jsx + CSS (phone horizontal, tablet/laptop vertical, removed caption/buyer/avatar/desc/view details/icons, budget format, hover lift 1100px+)
4. Step 2 - Grid/counts (.lfr-grid gaps/padding, initial counts 4/6/8 via window-width hook, See all requests button, buyer_requests limit 40->16)
5. Step 3 - Section heading People Looking For 20px/22px weight 800 with See all green link 44px tap target
6. Step 1 v3 - Home now renders LookingForRequestCard (shared redesigned card); removed old inline lfr-card markup/CSS
7. Step 2 v3 - grid/counts already in place (4/6/8, See all requests, limit 16)
8. Step 3 v3 - heading People Looking For already in place
9. Step 1 laptop-fix - card footer column at 768px+ (gap 10px, buyer row space-between, full-width button box-sizing border-box, no margin)
10. Step 2 laptop-fix - grid aligns with heading/toolbar (section padding 14px/24px, grid no side padding)
11. Step 1 toolbar-polish - removed View all button, lf-toolbar gap 8px no wrap/overflow, pills 44px flex on phone, round + button; natural width + Post Request on tablet+
12. Step 2 toolbar-polish - buyer name sentence case 12px weight 600 #5f6368 max-width 96px ellipsis
13. Step 1 home-simplify - removed toolbar row (location/sort), kept newest-first no filter, disabled auto-near effect
14. Step 2 home-simplify - heading row flex with title ellipsis, phone only + button, tablet+ See all + Post Request, gap 16px
15. Step 1 plus-icon - phone + button transparent 44x44, Plus 28px stroke 2.5 green, active opacity 0.6; tablet+ unchanged green button
16. Step 1 home-actions - Make offer reuses shared makeOffer helper (login prompt, own request hidden); button stopPropagation
17. Step 2 home-actions - card tap opens details with role link/tabIndex/Enter/cursor/:active bg; no double nav
18. Step 1 home-offer-fix - shared handler now uses optional onOfferStarted callback instead of setRequests; page/Home pass own updaters
19. Step 2 home-offer-fix - audited src for undeclared setters; only Home/Notifications/LookingFor use declared setters
20. Step 1 home-card-open - LookingFor page reads ?request= param and opens details modal; Home card navigates to same URL
21. Step 2 home-card-open - card click handling restored (role link/tabIndex/Enter/cursor/:active), only Make offer stops propagation
22. Step 3 home-card-open - added then removed temporary [lf-card-open] console.log; grep clean
23. Step 1-4 home-shops-v2 - removed discover strip, heading row Trusted Shops See all, new ts-card (cover/logo/body/meta), rail phone/tablet + end tile, grid laptop + seeall btn, load 8 shops, skeleton, empty hide
24. Step 1-2 home-shops-fix - shop card media block (cover overflow hidden, logo overlap), CSS moved out of mobile media query, laptop grid 4 cols with padding 24px
25. Step 1 home-shops-open-tile-v2 - rail end tile replaced with dashed Open a Shop tile (140px, Plus circle, role/tabIndex/Enter, :active), handler uses currentUser.shop_slug -> My Shop/Store else /shop-setup
26. Step 2 home-shops-open-tile-v2 - laptop row: existing outline See all shops + solid green #0F9D58 Open a Shop button (white, 44px, radius 12, pad 0 20), shared openShop handler + My Shop rule
27. Verify+bump home-shops-open-tile-v2 - build ok; no-undef clean; headless Chrome 360/768/1280: rail tile 140px dashed #0F9D58, Open a Shop -> /shop-setup, My Shop -> /shop/<slug>, laptop green btn 44px -> same; no console errors; sw v49
28. Step 1 home-shops-laptop-tile - removed laptop See all shops/Open a Shop buttons row; Open a Shop tile is last cell of 4-col grid (width 100%, stretched, dashed, same openShop/ownsShop); hide 8th shop at 1100+ so 7 shops + tile; rail shows 8 shops + tile
29. Step 2 home-shops-laptop-tile - heading "See all" link retained and is now the only /shops link in Trusted Shops on all sizes (grep confirmed single occurrence)
30. Step 1 home-services-v2 - heading row (Services 20/22px, See all green 44px), removed icon/count/subtitle; Home-specific hsvc card (cover 110px, category pill, provider+verified, rating/new+city, price, full-width Book now stopPropagation/login prompt), rail 240px + 140px dashed Offer tile, laptop 4-col grid 7+tile, skeletons, empty dashed tile; services query select * in active/published limit 20 + one profiles fetch (shop_name/full_name/avatar/is_verified) attached via isServiceVerified, rankServices featured-first 8 rail/7 grid; card tap reuses existing ProviderModal/onServiceClick (no extra view counter)

31. Fix home-services-v2 - price format From MK + /hr, heading/See all match Trusted Shops classes, profiles query select only id,full_name,avatar_url (remove shop_name/is_verified) to fix 400 and show provider name from full_name

32. Fix home-services-v2 rails <1100px - hsvc rail scroll-padding-left 14px, card/offer tile 240px fixed (flex 0 0 240px,width/max/min 240px, offer align-self stretch), cover 110px explicit; ts rail card/open tile aligned to 240px fixed (handlers unchanged)

33. Fix home-services-v2 verified tick - provider line name+16px blue BadgeCheck (gap 4px, flex none, aria Verified) when verified via isServiceVerified(svc,profile) same as /services; profiles select includes is_verified with fallback to id,full_name,avatar_url; tick renders on rail and grid cards

34. Report chat-popup-reply bug (popup reply vs normal chat) and add sql/chat_popup_diagnose.sql (no code changes)
35. chat-popup-reply step 1: sendMessageReply accepts chatSource and passes it to sendChatMessage; notifications carry chat_source; legacy retry only strips columns named in the error (keeps listing_id/service_id)
36. chat-popup-reply step 2: NotificationToast resolves chatSource from notification data, else the anchor message by message_id, else the latest message between the pair; reply keeps original source/context
37. chat-popup-reply step 3: new_message producers audited (Chat.jsx, forwardMessage.js, sendMessageReply.js); all now carry chat_source plus typed listing/service/shop/request context (offer/wanted/call notifications use other types)
38. src/utils/sendMessageReply.test-note: quick replies now reuse the original message's chat_source and typed context (message_id lookup, latest-message fallback), so they stay in the same conversation instead of creating a new direct chat
39. chat-popup-reply step 3-4: verified no-undef clean for the four chat files, build passed, sw cache bumped sokomw-v52 (live v51), merged to master and pushed
40. chat-quick-replies step 1: added request seller and buyer quick-reply sets; request chats no longer show listing lines; listing/service/shop/direct sets unchanged
41. chat-quick-replies step 2: request role detection guards on request.user_id and currentUser; no quick replies until owner is known, failed lookup shows none, never listing set
42. chat-quick-replies step 3: quick-reply tap behavior unchanged (fills input via setNewMsg, focused), so sends still go through existing sendMessage with chat_source=request and request_id
43. chat-quick-replies verify: eslint no-undef clean, build passed, sw cache bumped sokomw-v53 (live v52), merged to master and pushed
44. services-filter-sheet step 1: Filters and Sort sheets now render through createPortal to document.body
45. services-filter-sheet step 2: overlay is fixed inset 0, rgba(0,0,0,.45), z-index 1200 (above bottom nav 1000; no nav values needed raising)
46. services-filter-sheet step 3: sheet panels z-index 1201 so they sit above their own backdrop (1200), max-height 85dvh with overflow hidden; safe-area padding kept on the footer only, so the whole sheet stays visible above header and bottom nav
47. services-filter-sheet verify: eslint no-undef clean, build passed, sw cache bumped sokomw-v54 (live v53), merged to master and pushed
48. service-details-page step 1: public /services/:id route (lazy ServiceDetailsPage), bottom nav hidden for /services/<id>, not-found state with Browse services/Go back
49. service-details-page step 2: fetch service (select *), profile with is_verified/created_at fallback, shop name, reviews limit 50, similar active same-category limit 8, session view count, rate/experience formatting, document.title
50. service-details-page step 3: full public layout - gallery with dots and lightbox, header/provider/stats, about/skills/coverage/contact (masked reveal), safety tip, similar rail, sticky side card, bottom bar, report modal, edit sheet embedding ServiceForm, share/call/whatsapp/chat
51. service-details-page step 4: full testimonials UI - avg/stars/five-bar summary (latest 50 note), review cards with avatar, title-case name, stars, relative date, 4-line clamp + Read more, show 3 then See all, delete own review, eligibility query on messages, write-review form with 5 tappable stars + 1000-char counter, login prompt, unique-violation message
52. service-details-page step 5: profiles select fixed (id, full_name, avatar_url, is_verified, avg_response_seconds, response_sample_count, fast_responder, no created_at), Listed since from service.created_at, Fast responder chip / Replies in about X from real response sample data, Call copies number on mouse/laptop and keeps tel: on touch, review SQL files added
53. service-details-page step 6: browser test passed, sw cache bumped to sokomw-v55, merged wip/service-details-page into master and pushed
54. phase-c step 1: Home service cards now navigate to /services/:id via the card's own id; removed unused selectedService state, ProviderModal render and import; Book now handlers unchanged
55. phase-c step 2: Services page cards (featured rail, browse grid, My Services) navigate to /services/:id via each card's id; removed selectedProvider state, view-count effect, ProviderModal render and import; filters, sort, paging and Book now unchanged
56. phase-c step 3: remaining service entry points open /services/:id - SearchPage live rows and Services tab result cards, ListingsPage Services tab result cards, StoryViewer service tag, and Notifications fall back to the service page when data.service_id is present; service chat/new_message routing unchanged
57. phase-c step 3 verify: eslint no-undef clean for the four touched files (pre-existing count/unused warnings untouched); npm run build passed; sw cache bumped sokomw-v56 (live v55)
58. undo unrelated file changes: restored docs/response.dm, public/version.json and dist/index.html to master; public/sw.js kept at sokomw-v56; source code untouched
59. fix undefined count in search totals: the orphan safe block in ListingsPage and SearchPage Services tab counts now returns 0 instead of the undefined count; all other count returns untouched
60. merge: merged wip/service-cards-to-page into master (no-ff) after browser test passed; service cards, search/listing results, story tags and notifications now open /services/:id, sw cache sokomw-v56
61. fix profiles district: ServicesPage profiles select no longer requests district (line 784 only); district label and existing error fallback untouched
62. bump sw cache: CACHE_VERSION sokomw-v56 -> sokomw-v57 for the profiles district fix
63. make /services public step 1: App.jsx /services route no longer requires authed; ServicesPage auth uses audited (no code change)
64. make /services public step 2: ServicesPage Post a Service/List service/My Services/Edit/openForUser callbacks send logged-out visitors to /login; ?tab=post redirects only after auth finishes loading
65. make /services public step 3: Book now onBook handlers (featured rail + browse grid) navigate to /login when currentUser is empty; logged-in chat navigation unchanged; My Services cards show Manage, not Book now
66. make /services public step 5: SokoNav adds isGuest from auth getUser; desktop guest header shows Log in/Sign up instead of Chats/Alerts/Post Now/avatar; mobile guest header shows Log in instead of bell/profile; both navigate to /login
67. make /services public step 4: both onChat handlers (featured rail + browse grid) navigate to /login when currentUser is empty; logged-in trackServiceChat and chat navigation unchanged
68. bump sw cache: CACHE_VERSION sokomw-v57 -> sokomw-v58 for public /services and guest header changes
69. service-card-ratings step 1: ServiceCard shows rating_avg/rating_count star line or No reviews yet; styles and Star import added; services query still select('*')
70. service-card-ratings step 2: bump sw cache to sokomw-v59 for service card star ratings
71. card-review-link step 1: ServiceDetailsPage wraps visible Reviews section in #reviews and scrolls to it on #reviews hash after loading; ServiceCard rating line links to /services/:id#reviews
72. card-review-link step 2: bump sw cache to sokomw-v60 for the Reviews section link
73. fix-undefined-vars: import estimateDuration in CallBudgetSelector, define title in notifyOfferExpired, add desktopFileRef and use import.meta.env.DEV in Admin
74. fix-undefined-vars step 2: bump sw cache to sokomw-v61 for the undefined variable fixes
75. service-provider-name: brand_name field on ServiceForm; Services/ServiceDetails/Home cards show brand_name or person name, shop name lookups removed
76. service-provider-name step 2: bump sw cache to sokomw-v62 for the brand name display changes
77. repo-cleanup: fix .gitignore encoding, untrack generated files, fix Notifications services select, remove dead service files, record brand_name migration
78. bump sw cache: CACHE_VERSION sokomw-v62 -> sokomw-v63 for repo cleanup changes
79. remove-provider-modal step 1: ProviderModal reference report captured
80. remove-provider-modal step 2: delete unused ProviderModal.jsx and ReviewSection.jsx
81. remove-provider-modal step 3: build and eslint checks passed
82. remove-provider-modal step 4: preview started on port 4175 and stopped
83. profile-errors step 1: remove service_requests query, keep serviceReqs fixed null
84. profile-errors step 2: recompute_user_achievements call left unchanged
85. profile-errors step 3: build and eslint checks passed
86. profile-errors step 4: preview restarted on port 4175
87. home-banner-contain: object-fit contain applied to phone and tablet banner images
88. home-banner-contain: bump sw to v67
89. home-hero-premium: hero banner redesign with search above, overlay, blur, swipe
90. home-hero-premium: hero polish (padding, heights, blur 14, overlay gated on title)
91. home-hero-premium: hero alignment (wrapper, dots right, overlay padding, desc 2 lines)
92. home-hero-premium: banner price overlay from linked listing
93. home-hero-premium: space above search bar
94. home-hero-premium: 300px laptop height, white price
95. home-hero-premium: fix laptop height override
96. home-hero-premium: compact phone overlay
97. home-hero-premium: fix laptop height via JS viewport
98. home-hero-premium: restore live search and notify
99. home-hero-premium: compact create status tile
100. home-hero-premium: align and widen create status tile
101. home-hero-premium: align status row to hero edge
102. Step 1 home-status-align: align status row to hero edge
103. Step 1 home-hero-wide: widen hero block and status row to 1400
104. Step 1 home-category-padding: removed double side padding in Shop by Category
105. Step 1 header-search: added shared SearchBox (44px input, grouped live results, no-results actions, portaled notify modal); hero reused it
106. Step 2 header-search: SokoNav switches to SearchBox only at 1100px+; 769-1099px tablet search markup and navigation preserved raw
107. header-search verify: npm run build passed; SearchBox eslint clean; Home/SokoNav/SearchPage lint counts unchanged (pre-existing only)
108. Commit header-search: live suggestions and notify on laptop
109. Home: hide hero search (.hb-search) at min-width 1100px only; phone/tablet unchanged
110. Header search on tablet: shared SearchBox shown from 769px up, old tablet input hidden at same breakpoint, .hb-search hidden from 769px; phone magnifier unchanged
111. Home header-banner spacing: .hb-wrap padding-top 16px at 769px+ and 20px at 1100px+; phone unchanged, early access strip has no bottom margin so no double gap
112. Home banner ratio: box/skeleton aspect 1200/667 below 769px and 14/3 with max-height 300px at 769px+; image-ratio tolerance 12%, no fixed heights
113. Admin banners: two shape-aware slots, optional text
114. Banner: desktop/tablet shape changed from 14:3 to 4:1; phone 1200/667 unchanged
115. Banner: blurred copy uses the same picture as front image
116. Banner: split layout (text + illustration)
117. Banner: split on tablet and laptop only
118. Home: skeleton loading for Recommended
119. Home: category row fills width on laptop
120. Home: category grid (4x2 phone, 8 across laptop)
121. Home: fix category grid on phone
Home: category heading and icons
Hide Get Featured adverts (SHOW_FEATURED_ADS=false)
Home: gap between categories and Latest Listings
Hide feature-a-product options (SHOW_FEATURED_ADS)
Home statuses: remove type badge, show price
Home statuses: compact cards, Add status card, heading
Home statuses: fix card layout overlap and price cut-off
Home statuses: two-row top zone, time only
Home statuses: scroll, arrows, fades, view-all card, skeleton
Home statuses: light skeleton, viewer covers header
Home statuses: fix top clipping on hover
Home statuses: rotating order with seen tracking (temp demo helper)
Home statuses: priority multipliers (location, verified, completeness)
Home statuses: remove temp demo helper
Explore: redesign to match Home, shared categories config
Explore: chevrons, grid overflow, row text
Explore: label wrapping and row subtitles
Explore: section spacing
Explore: tighten category spacing
Looking for: remove hero, slim header row
Looking for: filter sheet, chips, segmented tabs, near-you strip
Looking for: phone filter sheet and chips
Looking for: fix use-before-init crash
Looking For: keep expired requests in Mine, pin header
Looking For: No longer active badge on expired cards
Looking For: pin only tabs row
Looking For: reactivate expired requests
Looking For: auto GPS location, ignore profile city
Home: fix missing requests, rank Looking For cards by priority
Home: Manage button on own requests
Looking For: redesign request detail view, remove km estimate
Looking For: clean targeted eslint errors in detail-view file
Looking For: detail view fixes, action bar above nav, sane distance
Looking For: capture accurate GPS when posting, safer distance
Looking For: GPS distance filter and nearest sort
Looking For: batch loading per device, image viewer
Notifications: compact rows, unread state, remove side rails
Notifications: grouped containers on phone, avatar fallback, tighter rows
Notifications: wider titles on phone, type icons for system rows
Install bar: compact, above bottom nav, 14 day dismiss
Notifications: typography, copy, merged messages, centred laptop column
Notifications: viewer name, tighter rows, 2-line titles on phone
Notifications: listing photo on view rows
Notifications: remove Orders and System tabs
Notifications: unread-only count, clearer time, solid header
Chats: product-first rows, unread tab, responsive panes
Chats: real images, full-width rows, avatar and menu fixes
Chats: price on phone, image URL helper
Chats: unread pill on preview line, no row gap
Chats: space before dot
Rail: plain green plus on desktop
Chats: remove New Message, responsive popup menu
Chat view: compact header, grouped bubbles, disappearing menu, listings 400 fix
Chat view: date pill, compact offer card, 15px text
Chat view: offer card price format, time, avatar, width
