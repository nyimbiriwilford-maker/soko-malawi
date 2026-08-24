# SokoMW (Shoppage) — Strategic Roadmap for Micro-Entrepreneur Empowerment

## 1. Current State Audit

### Strengths
- **Modern stack**: React 19, Vite 8, Supabase (Postgres/RLS, Realtime, Edge Functions), Tailwind v4.
- **Rich marketplace core**: Listings, Shops, Looking For, Jobs, Services, Stories, Verification.
- **Mobile-first UX**: App-like shell, sticky bottom nav, touch-optimized cards, horizontal rails.
- **Trust infrastructure**: Verification wizard, vouch-chain, trust scores, shop ratings.
- **Real-time comms**: WebRTC calling, chat, presence.
- **Monetization hooks**: Featured listings/shops, story promotion, free-feature quota system.
- **Location-aware**: GPS auto-detect, district/city filters, map embeds.
- **Offline awareness**: Basic offline page + reconnection toast.

### Limitations
- **Shop operations are thin**: No order management, inventory tracking, analytics, or customer CRM.
- **No in-app checkout**: Explicitly offline for payments; only initiate-payment edge function exists for featured promotions via Paychangu.
- **Heavy bundle**: Many inline style objects + large CSS strings in JS; no code-splitting strategy evident.
- **Data-agnostic UX**: No low-bandwidth mode, no image compression controls, no progressive image loading strategy.
- **Language**: English-only; no Chichewa support.
- **Feature-phone gap**: No USSD/SMS-based shop creation or listing.
- **Logistics**: No delivery/shipping integration; buyers and sellers self-coordinate.
- **Digital literacy**: Onboarding and shop setup are functional but lack guided walkthroughs for non-technical users.

## 2. Problem Identification — Barriers for Malawian Micro-Entrepreneurs

| Barrier | Evidence in Codebase | Impact |
|---|---|---|
| **Mobile data cost** | High-res images default; no compression pipeline; no data-saver mode. | Users on limited data avoid uploading or browsing. |
| **Low-bandwidth connectivity** | OfflinePage exists but no offline browsing/caching of listings. | Interrupted sessions lose progress; no background sync. |
| **Payment friction** | No in-app checkout; Paychangu only for promotions. | Sellers cannot collect payment digitally; rely on cash/WhatsApp. |
| **Digital literacy** | 4-step shop setup assumes comfort with file uploads, themes, slugs. | High drop-off risk for first-time shop owners. |
| **Trust & discovery** | Verification exists but is opt-in; no seller ratings/reviews on shops. | Buyers hesitant; sellers struggle to convert views to sales. |
| **Logistics** | No shipping integration; no delivery tracking. | Sellers limit reach to walk-in customers only. |
| **Inventory management** | No stock tracking, low-stock alerts, or bulk variants. | Overselling or stockouts damage reputation. |
| **Language** | English-only UI. | Excludes non-English-speaking vendors and buyers. |
| **Feature-phone exclusion** | Web-only; no USSD/SMS. | 60%+ of Malawian mobile users on feature phones cannot participate. |

## 3. Strategic Development Plan

### Vision
Transform SokoMW from a **marketplace directory** into a **complete micro-entrepreneur OS** — enabling anyone with a phone to open, operate, and grow a digital storefront without technical skills.

### Phased Evolution

#### Phase 1: Foundation — "Open Shop in 60 Seconds"
**Goal**: Reduce time-to-first-sale for new vendors.
- Launch lightweight PWA with offline listing cache.
- Order management workflow (buyer → seller → fulfillment).
- Basic shop analytics (views, saves, contact clicks).
- Simplified re-onboarding flow with contextual tooltips.

#### Phase 2: Commerce — "Collect Payments & Deliver"
**Goal**: Close the transaction loop in-app.
- In-app checkout with **Airtel Money**, **MTN MoMo**, and bank-transfer integrations.
- Secure escrow/hold until delivery confirmation.
- Delivery partner API (local couriers) with tracking.
- SMS notifications for order status.

#### Phase 3: Growth — "Scale Without Stress"
**Goal**: Give sellers tools to grow demand and efficiency.
- Inventory management (stock levels, low-stock alerts, bulk variants).
- Bulk listing tools (CSV upload, template cloning).
- Promotions engine (discounts, coupons, flash sales).
- Referral/affiliate system.

#### Phase 4: Inclusion — "No One Left Behind"
**Goal**: Reach the mass market including feature-phone users.
- USSD shop creation and listing via shortcode (*123#).
- SMS-based catalog browsing.
- Chichewa/Tumbuka localization.
- Data-saver mode (text-only browsing, compressed images).

## 4. Feature Roadmap

### Quick Wins (0–6 weeks)
- **Progressive Web App (PWA)**: Add manifest, service worker, install prompt.
- **Offline Browsing**: Cache latest listings via Service Worker + Supabase Realtime fallback.
- **Shop Analytics**: Add view_count, save_count, contact_click_count to shops/listings; surface in dashboard.
- **Order Object**: New orders table + order-status flow (pending → accepted → dispatched → delivered → rated).
- **Image Compression**: Client-side resize/compress before R2 upload (reduce data cost by ~70%).

### Medium-Term (6–20 weeks)
- **In-App Payments**: Integrate Paychangu for direct seller payouts + Airtel Money/MTN MoMo APIs.
- **Escrow System**: Hold funds until buyer confirms delivery; release to seller.
- **Delivery Integration**: Partner with local couriers (e.g., Zoom Bus, Post Corporation) via API/webhook.
- **SMS Notifications**: Twilio or local SMS gateway for order updates (low data cost).
- **Inventory Tracking**: Add stock_qty, low_stock_threshold, auto-delist when zero.
- **Product Variants**: Size, color, model selectors on listings.

### Long-Term (20–40 weeks)
- **USSD Gateway**: Enable shop creation and catalog updates via USSD sessions.
- **Seller Academy**: In-app tutorials, video guides, checklist for new sellers.
- **Bulk Listing Tools**: CSV import, template cloning, cross-post from other platforms.
- **Advanced Analytics**: Revenue trends, buyer demographics, conversion funnels.
- **Community/Reviews**: Shop reviews, seller badges, buyer-seller dispute resolution.
- **Localization**: Full Chichewa/Tumbuka translation + regional dialect support.

## 5. Execution Framework

### Prioritization Matrix
Use **Impact × Ease** scoring:
1. **PWA + Offline** (High impact, Medium ease) — Unlock broader reach immediately.
2. **Order Management** (High impact, Medium ease) — Essential before payments.
3. **Image Compression** (High impact, Low ease) — Immediate data-cost win.
4. **In-App Payments** (High impact, High ease) — Revenue multiplier.
5. **Shop Analytics** (Medium impact, Low ease) — Quick dashboard win.
6. **USSD/SMS** (High impact, Hard ease) — Reaches mass market but complex.
7. **Inventory** (Medium impact, Medium ease) — Needed for serious sellers.
8. **Localization** (Medium impact, High ease) — Good parallel track.

### Sprint Structure
- **2-week sprints** with a shippable increment.
- **Sprint 0**: Baseline audit, set up monitoring, define success metrics (time-to-first-sale, listing completion rate, payment conversion).
- **Sprint 1–2**: PWA manifest + service worker + offline cache.
- **Sprint 3–4**: Order management + seller notifications.
- **Sprint 5–6**: Image compression + shop analytics.
- **Sprint 7–8**: Payment integration (Paychangu + mobile money).
- **Sprint 9–10**: Escrow + delivery tracking.
- **Sprint 11–12**: Inventory + product variants.
- **Sprint 13–14**: USSD MVP + SMS notifications.
- **Sprint 15–16**: Seller academy + localization.

### Risk Mitigation
- **Data costs**: Default to compressed images; offer text-only mode.
- **Trust**: Start with escrow before opening reviews; verify sellers before allowing payouts.
- **Adoption**: Gamify shop setup (progress bar, rewards); partner with market associations.
- **Technical debt**: Extract inline CSS to CSS modules/Tailwind utilities; implement route-based code splitting.

### Success Metrics
- **Vendor activation**: % of onboarded users who publish first listing within 24h.
- **Time-to-first-sale**: From shop creation to first order.
- **Order completion rate**: % of orders that reach "delivered" state.
- **Data efficiency**: Average MB per listing browse session (target <2MB on 3G).
- **Retention**: 7-day and 30-day seller retention.

---

# Implementation Log — 2026-08-20: Phase 1 Orders & Shop Operations

Executed the Phase 1 roadmap from `.kilo/plans/1787129912737-sokomw-shop-page-roadmap.md`.

## Delivered

### 1. Order lifecycle (DB)
- New migration `supabase/migrations/20260819_001_orders.sql`:
  - `orders` table + RLS (parties + shop owners + admin read-only surface; ALL writes go through SECURITY DEFINER RPCs so clients cannot bypass the state machine).
  - State machine RPCs: `place_order` (validates availability, enforces stock_qty, computes flash-sale → bulk-tier → base price server-side, reserves stock atomically), `update_order_status` (accept/decline/dispatch/deliver), `cancel_order` (buyer), `rate_order` (delivered → rated).
  - Stock release on decline/cancel; one-off listings auto-mark `sold` on delivery; realtime publication for live UI refresh.
  - `get_shop_analytics` RPC (views, saves, orders, revenue) powering the dashboard.
  - Idempotent guards for commerce columns (`stock_qty`, `availability_status`, `price_tiers`, `flash_sale_price`, `flash_sale_expires_at`, `sold_price`) since the listings table predates migrations.

### 2. Inventory enforcement
- DB trigger `trg_listings_stock_auto_delist`: flips `active/published → inactive` + `availability_status='not_available'` when stock hits 0; restores on restock.
- ShopDashboard Products tab: ± stock controls per product, low-stock (≤3) badges, low-stock banner on Overview.

### 3. Buyer flow
- `PlaceOrderModal`: quantity (≤stock), pickup/delivery (+address), payment method (COD / mobile money / card placeholder / other), phone + note, exact total matching DB pricing.
- `ListingDetail`: golden "Place Order" CTA (sidebar, desktop sticky bar, mobile sticky bar) with availability/out-of-stock gating; order-placed confirmation → `/orders`. Seller notification insert on new order (existing `notifications` pattern).

### 4. Order tracking & management
- `src/pages/OrdersPage.jsx` (+ `/orders` route in App.jsx): Active/Completed/Cancelled tabs, 4-step status stepper, buyer cancel (pre-dispatch), star rating ("delivered" only), chat link, realtime refresh.
- `src/components/OrderManager.jsx` in ShopDashboard's new **Orders** tab: status filter tabs, buyer details (address/phone/note), accept/decline/dispatch/deliver buttons with state rules, buyer notifications, realtime channel per shop, pending-order badge on the dashboard tab.

### 5. Analytics
- ShopDashboard Overview: orders received, pending count, product views, listing saves, delivered revenue (MWK) via `get_shop_analytics`.

### 6. PWA/offline + data costs
- `public/sw.js` v9: cache-first LRU image cache (same + cross-origin CDN, 120-image cap) → offline image browsing + no re-download of immutable uuid-named R2 images.
- Image compression already existed in `src/lib/r2.js` (WebP, 1200px, q0.78) — confirmed wired into all upload paths; no code change needed.
- PWA manifest + registration were already in place.

### Design
- New shared token file `src/constants/shopTokens.js` matching ShopPage/Home palette (#0F9D58) instead of ShopDashboard's isolated #2e7d32 palette; new order surfaces use these tokens.

## Notes / Follow-ups
- `flash_sale_expires_at` vs `flash_sale_ends_at` naming is inconsistent across read paths; orders RPC uses a `_soko_flash_ends_at()` helper covering both. Worth consolidating later.
- Pre-existing repo lint: 500+ errors; my new/modified files lint clean (the only remaining flags are the pre-existing App.jsx/ListingDetail ones).
- Build: `npm run build` ✅ (OrdersPage chunk 9.9 kB / 3.3 kB gzip).
- Run the migration in Supabase to activate. Next up (Phase 2): `create-checkout` Paychangu extension for prepaid orders.

---

# Buyer-Surface Premium UI Credibility Pass (Level 2) � IMPLEMENTED

Plan: `.kilo\plans\1787130020826-premium-shop-ui-credibility.md`

## Summary
Completed the Level 2 credibility pass across the buyer surface. All planned tasks delivered; no out-of-scope files touched.

## Changes

### 1. Shared currency formatter
- New `src/lib/format.js` exports `formatPrice(amount)` -> `"MK " + Number(...).toLocaleString('en-US')`.
- `src/lib/orders.js` now re-exports `formatPrice as formatMWK` (alias) so existing consumers (OrderManager, ShopDashboard) keep working unchanged. OrdersPage + PlaceOrderModal switched to `formatPrice`.

### 2. `ShopPage.jsx`
- Deleted `PLACEHOLDER_LISTINGS` and `PLACEHOLDER_SIMILAR_SHOPS` dead arrays.
- Stats bar reordered to Shop Rating -> Listings -> Followers; amber "Unverified" slot fully replaced with **"Open since <Mon YYYY>"** (from `shops.created_at`) or neutral gray "New shop" when `created_at` is absent. Positive-only verification remains via the header logo pill.
- Verify-banner benefit icons `? ?? ??` replaced with lucide `ShieldCheck`, `TrendingUp`, `Lock`.
- Both empty-policy states (tab + sidebar) now show one honest line with an info icon: *"Delivery and returns aren't listed � ask the shop in chat before ordering."* (owner variant appends a pointer; no invented policy text).
- Both `alert()` calls removed: feature failure keeps the inline featureToast; theme-update failure now uses a local `themeError` inline message near both swatch rows.

### 3. `ListingDetail.jsx`
- Removed Google Fonts `@import` for Inter; root `fontFamily` now `'DM Sans', 'Sora', system-ui` (canonical stack from `index.css`).
- Brand-accent green literals unified `#1a7a4a` -> `#0F9D58` (and shadow `rgba(26,122,74,.28)` -> `rgba(15,157,88,.28)`), restricted to complete accent sites; `CAT_META` / `CONDITION_META` / category color fallbacks and reds left untouched.
- All currency sites converted to `formatPrice(...)` (flash, bulk, booking, price row, total, Place Order CTA, sticky bars, related listings).
- Both feature-listing `alert()` calls replaced with inline `featureError` line inside the desktop/mobile sticky bars (auto-clears after 5s).
- Fact-based assurance strip added below the Place Order CTA in the sidebar: `Banknote` "Pay on delivery", `Eye` "Inspect before paying", `Star` "Rate after delivery" � no escrow claims.

### 4. `OrdersPage.jsx`
- Emoji glyphs swapped to lucide: `ShoppingBag` (empty state), `Package` (thumb fallback), `MapPin` (address), `Star` (rate button), `MessageCircle` (chat button).
- Currency via `formatPrice`.

### 5. `PlaceOrderModal.jsx`
- Emoji glyphs swapped to lucide: `Package` (thumb fallback).
- Currency via `formatPrice` (all 6 sites).
- Condensed one-line assurance strip (`Banknote`/`Eye`/`Star`) added above the total row.

## Validation
- `npm run build` � PASS; scope chunks roughly unchanged (ListingDetail 101.5 kB, ShopPage 130.8 kB, OrdersPage small).
- ESLint on the 6 scope files: 12 problems (9 errors / 3 warnings) vs pre-change baseline of 14 (11 / 3) � all remaining are pre-existing; no new errors introduced.
- Greps: zero `alert(` in scope files; zero `MWK ` string literals in scope; zero emoji-as-icons (`??????????????`) in the four buyer files; no `PLACEHOLDER_` remnants; no `formatMWK` references remain in scope files.

## Notes
- `orders.js` alias keeps `formatMWK` available for out-of-scope consumers (OrderManager, ShopDashboard) as planned.
- "Open since"/"New shop" is guarded by a `created_at` null-check per the plan.
- Manual walkthrough recommended per plan item 3 to eyeball the green-accent swap on a live listing.

---

# Admin Manual User Verification � IMPLEMENTED & DEPLOYED

## Summary
Added ability for admins to manually verify/unverify users without requiring a verification request. Useful for VIP sellers, staff accounts, and emergency verifications.

## Files Changed
- `supabase/migrations/20260824_admin_manual_verify_user.sql` (NEW) � DB functions with audit trail
- `src/lib/verification.js` � Added `adminManualVerifyUser` and `adminManualUnverifyUser`
- `src/components/AdminVerifiedSellers.jsx` � Added modal UI with justification/note fields

## Deployment
- Committed and pushed to `master` (commit `00f9e44`)
- Vercel deployment triggered automatically

## Next Steps
- Run `supabase migration up` to activate DB functions
- Test modal in AdminVerifiedSellers page
- Verify audit entries in `verification_audit_log`

## UI Completion (commit 2b0a7ad)
- Added manual verify modal with fields: User ID, Verification type, Justification, Admin note
- Added unverify button/mode with Reason field
- Both actions include confirmation dialogs and toast feedback
- Build passes cleanly

---

# Manual Verification: Search users by name/email/phone (not just ID) � IMPLEMENTED

## Problem
The manual verify/unverify modal only accepted a raw user UUID. Admins had no way to look a user up by name, email, or phone.

## Changes

### 1. New DB RPC � `supabase/migrations/20260824_admin_search_users.sql` (NEW)
- `admin_search_users(p_query, p_limit)` (SECURITY DEFINER, admin-only via `public.is_admin()`).
- Searches `profiles` by `full_name`, `email`, `phone`, `city` (ILIKE), with prefix matches ranked first.
- Also accepts a full UUID directly (backwards-compatible).
- Empty query returns the most recent profiles as a fallback list.
- Returns lightweight rows: `id, full_name, email, phone, city, avatar_url, is_verified, verification_status, created_at`.
- `GRANT EXECUTE ... TO authenticated` (RLS/admin-check inside the function).

### 2. `src/lib/verification.js`
- Added `adminSearchUsers(query, limit)` wrapper around the RPC, plus its export.

### 3. `src/components/AdminVerifiedSellers.jsx`
- Modal now leads with a **"Find user"** search box (debounced 300ms) instead of forcing a UUID.
- Typing a name/email/phone fetches matching users with `adminSearchUsers` and shows a scrollable result list (avatar, name, verified badge, email/phone/city).
- Clicking a result auto-fills the **Selected user ID** field; admins can still paste a raw UUID.
- Search state (query, results, loading, error) resets on open, cancel, overlay-click, and after a successful verify/unverify.

## Validation
- `esbuild` transform of `AdminVerifiedSellers.jsx` passes cleanly.
- ESLint on the edited files shows no new errors (only pre-existing ones remain).
- Run `supabase migration up` to activate the new RPC, then test the manual-verify modal search.

---

# Trimmed status videos fail to play in the viewer � FIXED

## Problem
Videos trimmed with the "meta trim" strategy keep the original file bytes and carry the clip window as a media fragment (`...mp4#t=10.000,25.000`). The status surfaces treated those URLs as non-videos and broke playback:

1. **Viewer misclassified trimmed videos as images** � `StoryViewer.isVideoUrl` used `/\.(mp4|mov|webm|m4v)(\?|$)/i`, which fails when the URL ends with `#t=�`. The video was rendered inside an `<img>` ? failed to load ("Couldn't load media").
2. **Publishing was crashing entirely** � the last commit (`acafb95`) added `trimMode: result.trimMode` to the publish snapshot, but `result` does not exist in `handlePublish` scope ? `ReferenceError` on every Publish.
3. **Re-encoded clips got double-trimmed** � without a correct `trimMode`, a `#t=` fragment could be appended to an already re-encoded clip, making the wrong segment play.
4. **Clip window lost on cached playback** � when media was served from the blob cache, the `#t=` fragment was stripped, so the clip played from the start with the wrong progress bar.
5. Same fragment-blind detection existed in `StatusPage` (story tiles + feed cards), `PublicProfile`, and `SavedStatusesPage`.

## Changes

### 1. `src/components/StoryViewer.jsx`
- `isVideoUrl` now delegates to `isStatusVideoUrl` (strips `#�` fragments and query strings before checking the extension).
- Parses the `#t=start,end` clip window for the current video (`parseClipWindow`), keeps it in a ref, and re-attaches it when serving from a cached blob URL.
- New `onLoadedMetadata` handler seeks to the clip start (covers blob/cached sources that lost the fragment).
- Progress bar + auto-advance are now clip-aware: progress maps `[start,end]` ? 0�100% and the story advances when the clip window ends � works whether the browser honors the fragment end, pauses without `ended`, or ignores the end entirely.

### 2. `src/components/StatusUploadModal.jsx`
- New `trimMode` state set from `trimStatusVideo` results (`applyUserTrim`), reset on file change/clear/annotate-bake.
- Snapshot now carries the real `trimMode` state (fixes the `result is not defined` ReferenceError that broke every publish).
- `runBackgroundPublish` tracks `effectiveTrimMode`: the fresh `trimMode` when re-trimming at publish time, and `'reencoded'` after compression � so a `#t=` fragment is only appended for true meta trims.

### 3. Fragment-aware video detection elsewhere
- `src/pages/StatusPage.jsx` � story tiles + feed cards now use `isStatusVideoUrl`.
- `src/pages/PublicProfile.jsx` � `isVideoUrl` strips `#�` before extension checks.
- `src/pages/SavedStatusesPage.jsx` � saved-status thumbnails use `isStatusVideoUrl`.

### 4. `src/utils/statusVideo.js`
- `pickRecorderMime` now prefers `video/mp4` (AVC1/AAC) when `MediaRecorder` supports it (Safari) before falling back to WebM � re-encoded trims are playable on iOS.

## Validation
- `npm run build` � PASS (4.6s, no errors).
- ESLint on all touched files � only pre-existing errors remain; no new issues introduced.

---

# Edit caption & delete status for owners � IMPLEMENTED

## Problem
Once a status was published, the owner could not change its caption or remove it � it had to run its full 24h expiry.

## Changes � `src/components/StoryViewer.jsx`
No migration needed: existing RLS (`20260711_security_hardening.sql`) already allows owners to UPDATE/DELETE their own `user_statuses` rows.

- **Owner menu** (? on your own status) gains two items: **Edit caption** and **Delete status** (red, two-step confirm).
- **Edit caption sheet**: pre-filled textarea (180-char limit + live counter), Save/Cancel. Saves via `update` on `user_statuses`, updates `localStories` in place so the caption changes instantly everywhere in the viewer (caption chip, text boards), toast confirmation.
- **Delete confirm sheet**: shows the status type (Video/Photo/Text) + caption preview, Delete/Cancel with busy state. Deletes the row, best-effort removes the uploaded media files from Supabase storage (parses `�/storage/v1/object/public/<bucket>/<path>` out of `media_urls`), removes the story from the local list and auto-advances to the next one (closes the viewer if none remain).
- Sheets pause playback/auto-advance while open and reset when switching stories.
- Added `IconTrash` + `IconVideoBadge` helpers; `MenuItem` supports a `danger` style.

## Validation
- `npm run build` � PASS.
- ESLint on `StoryViewer.jsx` � no new errors (same pre-existing set as before).
- Note: changes not committed yet � say the word and I'll push to master.

---

# Professional caption display on status media � IMPLEMENTED

## Problem
The status caption chip was absolutely positioned at `bottom: 12` of the media stage � directly **underneath** the floating bottom chrome (engagement row + CTA buttons), so it overlapped/was buried. It was also hidden entirely on tagged-product statuses, and auto-placeholder captions ("Photo update") rendered as noise.

## Changes � `src/components/StoryViewer.jsx`
- **Caption moved into the bottom chrome**, stacked between the product card and the engagement row (IG/WhatsApp style) � always readable over the chrome's gradient scrim, never collides with the action bar.
- **Professional chip styling**: soft translucent black `rgba(0,0,0,0.38)` + 12px blur, hairline border, 13px radius, 13.5px/600 white text with text-shadow for legibility on any frame.
- **2-line clamp with more/less**: long captions (>80 chars) clamp to 2 lines; tap expands the full text, resets per story.
- **Placeholder suppression**: generic auto-captions ("Photo update"/"Video update"/"Status update") are not shown; real captions now appear even on tagged-product statuses.
- Removed the old conflicting `bottom: 12` caption block.

## Validation
- `npm run build` � PASS.
- ESLint � no new errors. Not committed yet.

---

# Text-only statuses readable on the home page � IMPLEMENTED

## Problem
Text-only statuses store their background colour as `media_urls[0]` (e.g. `"#0f766e"`). Every preview surface treated that entry as an image URL and rendered `<img src="#0f766e">` � a broken/black tile with no way to read the message.

## Changes
- **`src/utils/statusVideo.js`** � new `isStatusColorBoard(url)` helper (detects `#rgb`/`#rrggbb`/`#rrggbbaa` board entries).
- **`src/components/StatusTextBoard.jsx` (NEW)** � reusable board preview: the status's background colour with its words rendered on top, WhatsApp-style auto text sizing (short text bigger, long text smaller + 5-line clamp), centred, white bold with text-shadow.
- **`src/components/HomeStatusSection.jsx`** � home page story tiles (mobile + desktop variants) now render `StatusTextBoard` for text statuses instead of a broken image; the bottom label no longer duplicates the words already shown on the board.
- **`src/pages/StatusPage.jsx`** � same treatment in the cinematic story tiles and the feed cards (larger text scale there). Also fixed a leftover stale regex in the feed card's video detection (missed by the earlier replaceAll) � it now uses `isStatusVideoUrl` too.
- **`src/pages/SavedStatusesPage.jsx`** � saved-status banners render the board colour + words.

## Result
A text status now looks like a real picture everywhere (home, status page, saved list): background colour visible, words readable at a glance. Opening the viewer still shows the full-screen text board.

## Validation
- `npm run build` � PASS.
- ESLint on touched files � only pre-existing errors. Not committed yet.
---

# Mobile audit of the shop page (`/shop/:slug`) — BUGS FOUND (no code changed)

Requested: "go to shop and find any bug that affects mobile view and mobile friendliness of the shop page."
Scope: `src/pages/ShopPage.jsx` (the single-shop storefront route `/shop/:slug`). Audited only — no code changed.

## Mobile bugs found

### 1. Product-card "Save" (heart) button is a dead button — no save logic
- `src/pages/ShopPage.jsx` ~L2920–2927 (grid view). The `.sp-fav-btn` renders an `aria-label="Save"` heart with:
  `onClick={e => e.stopPropagation()}` and nothing else.
- There is **no** save handler, no saved-state, no persistence (compare Home.jsx / ListingsPage.jsx / SearchPage.jsx which all implement real `onToggleSave`).
- Grid cards show a dead heart (no feedback, does nothing); list-view cards have no save affordance at all — inconsistent and misleading on mobile where it's a large 30–34px touch target.
- Fix direction (not applied): wire real save toggle + `aria-pressed` state, or remove the button.

### 2. "More shops you might like" rail is sticky but the tab bar it's designed to sit under is NOT sticky
- `.sp-similar-wrap` is `position: sticky; top: var(--sp-nav-offset); z-index: 35` at ALL widths, including mobile (L813–817).
- The `.sp-tabs` bar (Listings / About / Reviews / Policies) is **never** made sticky — there is no `position: sticky` rule for it anywhere.
- The mobile CSS comment (L1084) says the rail should "sit under sticky tabs (~100px)" — those sticky tabs don't exist, so the intent is unimplemented.
- Mobile-result: while scrolling products, the blurred white "More shops you might like" bar pins just below the top nav and floats **over** the product grid, while the tab switcher scrolls away. Users on mobile get a floating rail that covers listings and no way to switch shop tabs without scrolling to the top.

### 3. Shop rating tooltip is hover-only — invisible on touch
- `.sp-rating-tip` (L1153–1199) only appears via `.sp-rating-tip-wrap:hover` / `:focus` (L1194–1199). On mobile there is no hover, so the rating breakdown tooltip can never be seen.
- Also `hover`-only on desktop; touch users get nothing.

### 4. Star-rating preview is mouse-only
- Shop review stars use `onMouseEnter`/`onMouseLeave` for the hover preview (`setReviewHoverRating`) with no touch fallback (L3005–3018). On touch devices the live preview never lights up; tapping still sets the rating but there is no live feedback while choosing.

### 5. Sticky mobile Message/Follow bar can tuck under the global bottom nav
- `.sp-mobile-cta` is `position: fixed; bottom: calc(64px + env(safe-area-inset-bottom))`, `z-index: 90` (L1102–1115).
- The global mobile bottom nav (`.sbn-bar`, BottomNav.jsx L257–284) is also `position: fixed; bottom: 0`, `z-index: 100`, effective height ≈ 70px + safe-area (8px pad + ~52px content + 10px pad).
- On mobile both are mounted at once → the CTA bar's hard-coded `64px` sits ~6px lower than the nav's real top edge, so the bottom of the Message/Follow buttons (z-index 90 < 100) is clipped behind the nav. The 64px constant is a hard-coded guess and isn't derived from the real nav height (which includes a FAB / safe-area variations).

### 6. (Minor, non-mobile) Currency label `MK` is non-standard / inconsistent
- Prices render as `MK 1,000` (L2218, L2221, L3406) though Malawi uses **MWK** (`Kwacha`). There was a plan to unify via `formatPrice` from `src/lib/format.js`, but ShopPage defines its own local `formatPrice` that still emits `MK`. Cosmetic but user-facing.

## Quick wins (when you choose to fix)
- Real save (fav) toggle on product cards.
- Make `.sp-tabs` sticky on mobile and drop the similar-rail sticky (or tuck it under the sticky tabs).
- Add a media-query/tap fallback for the rating tooltip and star hover preview.
- Compute the mobile CTA position from the nav height instead of hard-coding 64px.
---

# Shop page mobile fixes — IMPLEMENTED (`src/pages/ShopPage.jsx`)

Fixed the mobile bugs found in the audit above. One audit item turned out to have no markup (see note below).

## Changes
1. **Save (heart) button now works** — grid + list view product cards have a real save toggle:
   - New `savedIds` (Set) + `saveBusyId` state, mirrors the Home/Listings flow: load from `listing_saves`, optimistic toggle via `toggle_listing_save` RPC, revert on error, redirect to `/login` (post-login save) when not signed in.
   - `Icon.Heart` now accepts `filled` and renders a red filled heart when saved; button gains `aria-pressed` + `saved` class + busy `disabled`.
   - List-view cards (which had no save button at all) now get the same heart.

2. **Sticky tab bar + similar-shops rail (mobile):**
   - `.sp-tabs` is now `position: sticky` on mobile (`top: calc(var(--sp-nav-offset) - 8px)`, z-index 40, full-width off-white bg) so Listings/About/Reviews/Policies stay reachable while scrolling.
   - `.sp-similar-wrap` is no longer sticky on mobile (`position: static`) so the "More shops you might like" rail no longer floats over the product grid. Removed the `has-sticky-cta` margin hack.

3. **Star-rating preview works on touch:** each rating star now also sets the preview via `onTouchStart` (previously mouse-hover only; click still commits).

4. **Sticky Message/Follow bar & page bottom spacing no longer guess the nav height:**
   - New measured CSS var `--sp-bottom-nav-offset` (from `.sbn-bar` `getBoundingClientRect().height`) set in the existing nav-measure effect.
   - `.sp-mobile-cta` bottom = `calc(var(--sp-bottom-nav-offset, 72px) + 8px)` (was a hard-coded `64px` that let buttons tuck under the taller bottom nav).
   - `.sp-root` mobile bottom padding uses the var too (plain + has-sticky-cta).

## Notes
- **Rating tooltip**: the `.sp-rating-tip` CSS has no matching `.sp-rating-tip-wrap` markup anywhere in ShopPage (it's leftover from the other pages / `homerrr` scratch). So there was no tooltip to make touch-friendly — left untouched.
- **Currency (`MK` vs `MWK`)**: intentionally not changed here (non-mobile cosmetic; would touch pricing strings in several files).
- **Desktop `.sp-similar-wrap`**: stays sticky (unchanged); the fix above targets the reported mobile behaviour.

## Validation
- `npm run build` — PASS (Vite/build succeeds).
---

# Shop page: Message/Follow no longer hide products — IMPLEMENTED (`src/pages/ShopPage.jsx`)

Problem: the fixed mobile Message/Follow bar floated over the product grid and hid shop content. Replaced it with professional inline placement.

## Changes
- **Removed the floating `.sp-mobile-cta` fixed bar** (JSX + all CSS + `showVisitorSticky` + `has-sticky-cta` class/hooks).
- **Visitor Message/Follow buttons now render inline in the shop header** next to the shop info — same treatment the page already used for shop owners (`.sp-owner-bar`). On mobile the action row becomes a full-width 2-column grid (`Message | Follow`), and the follower count sits centered beneath the buttons.
- **Page bottom padding** no longer needs the extra `has-sticky-cta` space (nothing floats over content now); the normal measured `--sp-bottom-nav-offset` bottom gap is kept so the global bottom nav never covers content.
- **De-duplicated followers**: mob follower count now shows only once (under the buttons); the duplicate copy in the meta line stays hidden.

## Result
On mobile the product grid is never overlapped — the actions live compactly in the header card.

## Validation
- `npm run build` — PASS.
