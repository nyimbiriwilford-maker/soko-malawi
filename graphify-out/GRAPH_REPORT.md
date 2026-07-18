# Graph Report - C:\Users\WILFORD NYIMBIRI\soko-malawi  (2026-07-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1052 nodes · 1811 edges · 76 communities (64 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d003258`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verification.js
- Notifications.jsx
- LookingFor.jsx
- Home.jsx
- SearchPage.jsx
- authApi.js
- ChatListPanel.jsx
- DealEducationModal.jsx
- index.js
- index.jsx
- ListingsPage.jsx
- PostListing.jsx
- App.jsx
- ServicesPage.jsx
- Profile.jsx
- ProductCard.jsx
- Services.jsx
- DealRequestCard.jsx
- ListingDetail.jsx
- devDependencies
- dependencies
- useStatuses.js
- vouchUtils.js
- GlobalCallListener.jsx
- PublicProfile.jsx
- ProfileUI.jsx
- ChatList.jsx
- supabase.js
- StatusPage.jsx
- Chat.jsx
- HomeStatusRow.jsx
- homeUtils.js
- isFlashActive
- manifest.json
- StoryViewer.jsx
- HeroSection.jsx
- RequestCard
- BottomNav.jsx
- ShopsPage.jsx
- usePresence.js
- ShopSetup.jsx
- index.ts
- package.json
- strip-notif-styles.mjs
- [slug].js
- useSearchAnimation.js
- ShopDashboard.jsx
- index.ts
- scripts
- Comments.jsx
- pushNotifications.js
- index.ts
- imports
- vercel.json
- InstallPrompt.jsx
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- tailwindcss
- sw.js
- authTokens.js
- index.ts
- index.ts

## God Nodes (most connected - your core abstractions)
1. `supabase` - 67 edges
2. `VerificationWizard()` - 18 edges
3. `T` - 12 edges
4. `useAuthFlow()` - 12 edges
5. `BottomNav()` - 11 edges
6. `isFlashActive()` - 11 edges
7. `validateEmail()` - 11 edges
8. `createAccountAfterOtp()` - 10 edges
9. `JobModal()` - 10 edges
10. `Notifications()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Chat()` --indirect_call--> `handler()`  [INFERRED]
  src/pages/Chat.jsx → api/shop-og/[slug].js
- `LookingForSection()` --references--> `react`  [EXTRACTED]
  src/pages/Home.jsx → package.json
- `RequestCard()` --references--> `react`  [EXTRACTED]
  src/pages/Home.jsx → package.json
- `FeaturedCard()` --calls--> `isFlashActive()`  [EXTRACTED]
  src/components/FeaturedSection.jsx → src/utils/homeUtils.js
- `FlashSaleStrip()` --calls--> `isFlashActive()`  [EXTRACTED]
  src/components/FlashSaleStrip.jsx → src/utils/homeUtils.js

## Import Cycles
- None detected.

## Communities (76 total, 12 thin omitted)

### Community 0 - "verification.js"
Cohesion: 0.06
Nodes (51): STEP_IDS, stepIndex(), VerificationWizard(), ADMIN_ACTIONABLE_STATUSES, adminConfirmPayment(), adminRejectPayment(), adminTransitionVerification(), cancelVerificationPayment() (+43 more)

### Community 1 - "Notifications.jsx"
Cohesion: 0.05
Nodes (39): AD_ANIMATED_ONCE, AD_IMAGE_CACHE, AdListingCard(), AdProductImage(), AvatarIcon(), CATEGORIES, CATEGORY_ICONS, DEFAULT_FILTER (+31 more)

### Community 2 - "LookingFor.jsx"
Cohesion: 0.09
Nodes (29): TABS, Icon, buildAds(), SellerOpportunityBanner(), ComposerField(), InfoChip(), SectionLabel(), Spinner() (+21 more)

### Community 3 - "Home.jsx"
Cohesion: 0.05
Nodes (10): CAT_FALLBACK_EMOJI, CAT_FILTERS, CAT_ICON, CatSVG, Icon, PILLARS, PRIORITY, QUICK_CATEGORIES (+2 more)

### Community 4 - "SearchPage.jsx"
Cohesion: 0.07
Nodes (21): ALL_DISTRICTS, AVAILABILITY_OPTIONS, CAT_STYLE, CATEGORY_TREE, catStyle(), conditionLabel(), CONDITIONS, FBListingCard() (+13 more)

### Community 5 - "authApi.js"
Cohesion: 0.14
Nodes (21): AUTH_MODES, useAuthFlow(), useLoginForm(), ALLOWED_EDGE_FUNCTIONS, ALLOWED_OAUTH_PROVIDERS, ALLOWED_ORIGINS, callEdgeFunction(), createAccountAfterOtp() (+13 more)

### Community 6 - "ChatListPanel.jsx"
Cohesion: 0.06
Nodes (12): CATEGORY_META, ChatListPanel(), CHIP_COLORS, CHIPS, decodeReply(), PILL_COLORS, PILLS, S (+4 more)

### Community 7 - "DealEducationModal.jsx"
Cohesion: 0.07
Nodes (31): DealEducationModal(), dealSummary, getNextTier(), getTier(), ghostBtn, handle, headerRow, modal (+23 more)

### Community 8 - "index.js"
Cohesion: 0.08
Nodes (5): Captcha(), loadTurnstileScript(), FloatingInput, PasswordInput, PROVIDERS

### Community 9 - "index.jsx"
Cohesion: 0.19
Nodes (22): TABS, JobCard(), BulletList(), JobModal(), CATEGORIES, CATEGORY_ICONS, CITIES, EMPTY_JOB_FORM (+14 more)

### Community 10 - "ListingsPage.jsx"
Cohesion: 0.09
Nodes (18): ALL_DISTRICTS, AVAILABILITY_OPTIONS, CATEGORY_TREE, CONDITIONS, dedupeLocation(), formatPrice(), Icon, isFlashSaleActive() (+10 more)

### Community 11 - "PostListing.jsx"
Cohesion: 0.07
Nodes (14): C, CONDITIONS, FEATURED_TIERS, GRAD, GUIDE_TIPS, MONTHS, NAV_TABS, PostListing() (+6 more)

### Community 12 - "App.jsx"
Cohesion: 0.08
Nodes (22): Admin, ChatsLayout, Home, Jobs, ListingDetail, ListingsPage, LookingFor, Notifications (+14 more)

### Community 13 - "ServicesPage.jsx"
Cohesion: 0.24
Nodes (18): MyListings(), ProviderModal(), ReviewSection(), AVAILABILITY_OPTIONS, avatarColor(), CITIES, formatWhatsApp(), initials() (+10 more)

### Community 14 - "Profile.jsx"
Cohesion: 0.14
Nodes (14): sellerLevelIcon(), blockUser(), bulkListingDelete(), bulkListingStatus(), emptyStats, followSeller(), recordListingShare(), syncProfileCompletion() (+6 more)

### Community 15 - "ProductCard.jsx"
Cohesion: 0.13
Nodes (16): CAT_EMOJI, FeaturedCard(), S, S, SORT_ICON, ProductCard(), S, useViewportTracking() (+8 more)

### Community 16 - "Services.jsx"
Cohesion: 0.27
Nodes (16): MyListings(), ProviderModal(), ReviewSection(), AVAILABILITY_OPTIONS, avatarColor(), CITIES, formatWhatsApp(), initials() (+8 more)

### Community 17 - "DealRequestCard.jsx"
Cohesion: 0.13
Nodes (18): alreadyVouchedNote, card(), confirmBtn, confirmedBadge, DealRequestCard(), getTier(), listingRow, progressChip() (+10 more)

### Community 18 - "ListingDetail.jsx"
Cohesion: 0.16
Nodes (15): StatusBadge(), fetchListingStatus(), fetchUserActiveStatus(), AVAILABILITY_META, BADGE_META, CAT_META, CONDITION_META, flashTimeLeft() (+7 more)

### Community 19 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, @eslint/js, globals, devDependencies, eslint, @eslint/js, globals, @tailwindcss/vite (+9 more)

### Community 20 - "dependencies"
Cohesion: 0.12
Nodes (17): @fontsource/dm-sans, @fontsource/sora, framer-motion, @huggingface/transformers, lucide-react, dependencies, @fontsource/dm-sans, @fontsource/sora (+9 more)

### Community 21 - "useStatuses.js"
Cohesion: 0.15
Nodes (10): HomeStatusRow(), AVAILABILITY_TEMPLATES, LISTING_TEMPLATES, StatusPicker(), WORK_TEMPLATES, StoryComposer(), EXPIRY_OPTIONS, fetchAllActiveStories() (+2 more)

### Community 22 - "vouchUtils.js"
Cohesion: 0.19
Nodes (12): bar, ghostBtn, greenBtn, confirmDeal(), getConfirmedDealCount(), getPendingDeal(), getTrustScore(), getVouchers() (+4 more)

### Community 23 - "GlobalCallListener.jsx"
Cohesion: 0.20
Nodes (9): S, GlobalCallListener(), S, stopRingtone(), CallContext, CallProvider(), useCall(), generateCallId() (+1 more)

### Community 24 - "PublicProfile.jsx"
Cohesion: 0.21
Nodes (9): FollowersManager(), TrustBadge(), VouchChainBanner(), VouchSection(), useVouchData(), getOnlineStatus(), PublicProfile(), submitVouch() (+1 more)

### Community 25 - "ProfileUI.jsx"
Cohesion: 0.12
Nodes (12): ActionCard(), Badge(), Chip(), EmptyState(), ICON_SIZE, IconButton(), MpIcon(), REGISTRY (+4 more)

### Community 26 - "ChatList.jsx"
Cohesion: 0.15
Nodes (8): ChatSidebar(), ICONS, S, CATEGORY_META, ChatList(), decodeReply(), PILLS, S

### Community 27 - "supabase.js"
Cohesion: 0.18
Nodes (4): TEMPLATES, supabase, T, styles

### Community 28 - "StatusPage.jsx"
Cohesion: 0.13
Nodes (7): CARD_GRADIENTS, CATEGORY_TABS, EXPIRY_LABELS, SORT_OPTIONS, T, TAB_META, TEMPLATES

### Community 29 - "Chat.jsx"
Cohesion: 0.20
Nodes (9): CallOverlay(), S, formatTime(), useWebRTC(), Chat(), decodeReply(), EMOJI_CATEGORIES, encodeReply() (+1 more)

### Community 30 - "HomeStatusRow.jsx"
Cohesion: 0.19
Nodes (10): getCatStyle(), StoryCard(), timeAgo(), BG_COLORS, CATEGORIES, inputStyle, label, MALAWI_LOCATIONS (+2 more)

### Community 31 - "homeUtils.js"
Cohesion: 0.28
Nodes (11): useViewportTracking(), getDistanceKm(), _getGuestSearchHistory(), _getGuestViewedMap(), getSearchHistory(), getViewedIds(), markAsViewed(), _searchRelevance() (+3 more)

### Community 32 - "isFlashActive"
Cohesion: 0.24
Nodes (11): FlashSaleStrip(), FlashTimer(), S, catIcon(), formatPrice(), LatestListingCard(), PremiumListingCard(), RevenueHero() (+3 more)

### Community 33 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, screenshots, short_name (+2 more)

### Community 34 - "StoryViewer.jsx"
Cohesion: 0.27
Nodes (8): FollowButton(), fmtK(), GRADIENTS, REACTIONS, StoryViewer(), timeAgoFn(), TYPE_META, useFollow()

### Community 35 - "HeroSection.jsx"
Cohesion: 0.25
Nodes (9): CAT_COLORS, CAT_EMOJI, formatPrice(), getCatColor(), HeroSection(), Icon, isFlashActive(), T (+1 more)

### Community 36 - "RequestCard"
Cohesion: 0.22
Nodes (10): react, react, catColors(), catFallbackEmoji(), catLabel(), expiryInfo(), getCatSVG(), getPriority() (+2 more)

### Community 38 - "ShopsPage.jsx"
Cohesion: 0.22
Nodes (9): CAT_ICONS, CATEGORIES, DISTRICTS, Icon, initials(), SHOP_TYPES, ShopsPage(), SORT_OPTIONS (+1 more)

### Community 39 - "usePresence.js"
Cohesion: 0.32
Nodes (6): App(), buildChannel(), listeners, notifyListeners(), useGlobalPresence(), watchUserOnline()

### Community 40 - "ShopSetup.jsx"
Cohesion: 0.29
Nodes (6): CATEGORIES, DISTRICTS, initials(), ShopSetup(), T, THEMES

### Community 42 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 43 - "strip-notif-styles.mjs"
Cohesion: 0.29
Nodes (6): after, before, c, end, p, start

### Community 44 - "[slug].js"
Cohesion: 0.53
Nodes (5): CRAWLER_UA_PATTERNS, escapeHtml(), handler(), isCrawler(), supabase

### Community 45 - "useSearchAnimation.js"
Cohesion: 0.40
Nodes (4): useSearchAnimation(), useUserLocation(), Home(), randBetween()

### Community 46 - "ShopDashboard.jsx"
Cohesion: 0.40
Nodes (5): CATEGORIES, DISTRICTS, initials(), ShopDashboard(), T

### Community 48 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 49 - "Comments.jsx"
Cohesion: 0.50
Nodes (3): Comments(), CommentThread(), timeAgo()

### Community 50 - "pushNotifications.js"
Cohesion: 0.67
Nodes (3): listenForServiceWorkerMessages(), registerPushNotifications(), urlBase64ToUint8Array()

### Community 52 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 53 - "vercel.json"
Cohesion: 0.50
Nodes (3): headers, outputDirectory, rewrites

## Knowledge Gaps
- **274 isolated node(s):** `supabase`, `name`, `private`, `version`, `type` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `supabase.js` to `verification.js`, `Notifications.jsx`, `LookingFor.jsx`, `Home.jsx`, `SearchPage.jsx`, `authApi.js`, `ChatListPanel.jsx`, `DealEducationModal.jsx`, `index.jsx`, `ListingsPage.jsx`, `PostListing.jsx`, `App.jsx`, `ServicesPage.jsx`, `Profile.jsx`, `ProductCard.jsx`, `Services.jsx`, `DealRequestCard.jsx`, `ListingDetail.jsx`, `useStatuses.js`, `vouchUtils.js`, `GlobalCallListener.jsx`, `PublicProfile.jsx`, `ChatList.jsx`, `StatusPage.jsx`, `Chat.jsx`, `HomeStatusRow.jsx`, `homeUtils.js`, `StoryViewer.jsx`, `BottomNav.jsx`, `ShopsPage.jsx`, `usePresence.js`, `ShopSetup.jsx`, `ShopDashboard.jsx`, `Comments.jsx`?**
  _High betweenness centrality (0.358) - this node is a cross-community bridge._
- **Why does `react` connect `RequestCard` to `dependencies`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `RequestCard`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `supabase`, `name`, `private` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verification.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057342657342657345 - nodes in this community are weakly interconnected._
- **Should `Notifications.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05084745762711865 - nodes in this community are weakly interconnected._
- **Should `LookingFor.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09154437456324249 - nodes in this community are weakly interconnected._