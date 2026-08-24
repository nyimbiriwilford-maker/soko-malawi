# SokoMW Shop Ecosystem — Strategic Roadmap & Implementation Plan

## Context & Assumption
- "Shoppage" = the shop/storefront + listing + order-management subsystem inside **SokoMW** (React 19, Vite 8, Supabase, Tailwind v4).
- Goal: empower Malawian micro-entrepreneurs to **launch and manage digital storefronts** without technical skills.
- Scope: full-stack (schema, edge functions, UI, mobile UX). Excludes unrelated pillars (chat, statuses) unless they touch shop transactions.

## Current State (from code)
- **Shop setup** (`ShopSetup.jsx`): 4-step wizard → inserts `shops` row, marks `profiles.account_type='shop'`.
- **Public shop** (`ShopPage.jsx`): cover, logo, product grid/list, sidebar (About, Policies, Owner). Currently shows **placeholder listings**.
- **Seller dashboard** (`ShopDashboard.jsx`): Overview / Products / Edit Shop Info. No revenue, orders, or customer data.
- **Listings** (`PostListing.jsx`): rich form (images, video, location, booking, flash sale, bulk tiers, promotions). Draft saving + R2 upload.
- **Discovery** (`ShopsPage.jsx`): filters, follow/unfollow, blocked shops.
- **Payments** (`supabase/functions/initiate-payment`): Paychangu integration **only for featured promotions**. No checkout for listings.
- **Trust**: VerificationWizard, vouch-chain, trust scores.
- **Comms**: Chat + WebRTC calling.
- **Offline**: `OfflinePage.jsx` exists but **no service worker / offline cache**.

## Key Gaps (evidence-backed)
1. **No order lifecycle** — no `orders` table, no buyer→seller→fulfillment flow.
2. **No inventory enforcement** — `stock_qty` referenced but no auto-delist or low-stock alerts.
3. **No in-app checkout** — sellers cannot collect payment digitally; rely on cash/WhatsApp.
4. **No logistics** — no delivery partner integration or tracking.
5. **Thin analytics** — no revenue, conversion, or customer-retention metrics.
6. **High data cost** — no image compression, no progressive loading, no data-saver mode.
7. **No offline browsing** — service worker missing.
8. **Language exclusion** — English-only; no Chichewa/Tumbuka.
9. **Feature-phone exclusion** — no USSD/SMS access.
10. **Digital literacy** — shop setup is functional but lacks guided walkthrough for non-technical users.

## Proposed Phased Plan

### Phase 1: Foundation — "Open Shop in 60 Seconds"
Reduce time-to-first-sale and operational friction.

**Tasks:**
1. `orders` table + RLS + state machine (`pending` → `accepted` → `dispatched` → `delivered` → `rated` / `cancelled`).
2. Buyer flow: "Buy Now" / "Place Order" in `ListingDetail` → creates order record.
3. Seller order management in `ShopDashboard` (accept/decline, mark dispatched, view details).
4. Basic shop analytics (views, saves, contact-clicks, orders, revenue) via Supabase aggregations or lightweight MV.
5. PWA manifest + service worker (cache listings + shell, install prompt).
6. Client-side image compression (WebP, resize) before R2 upload.
7. `stock_qty` auto-delist logic + low-stock badge in dashboard.

### Phase 2: Commerce — "Collect Payments & Deliver"
Close the transaction loop.

**Tasks:**
1. Extend Paychangu edge function (or add `create-checkout`) for listing purchases.
2. Airtel Money / MTN MoMo mobile-money integration (USSD/API callback).
3. Escrow/hold: funds locked until buyer confirms delivery, then released to seller wallet.
4. Delivery partner API (local courier webhook) with tracking number + status sync.
5. SMS notifications for order status changes (Twilio or local gateway).

### Phase 3: Growth — "Scale Without Stress"
Give sellers tools to manage demand and efficiency.

**Tasks:**
1. Inventory UI (stock adjustments, low-stock alerts, bulk variants: size/color/model).
2. Bulk listing tools (CSV upload, template clone).
3. Unified promotions engine (discounts, coupons, flash sales) — consolidate existing `selectedPromotion` + flash-sale code.
4. Referral/affiliate system (share shop link, track conversions, seller credit).

### Phase 4: Inclusion — "No One Left Behind"
Reach mass market including feature-phone users.

**Tasks:**
1. USSD gateway (`*123#`) for shop creation and catalog browse/update.
2. SMS catalog query (keyword → list matches).
3. i18n extraction + Chichewa/Tumbuka translation.
4. Data-saver mode (text-only browse, compressed images, lazy loading toggle).

## Dependencies
- Phase 2 depends on Phase 1 orders existing before checkout/escrow can be built.
- Phase 3 inventory builds on `stock_qty` from Phase 1.
- Phase 4 USSD/SMS is independent but benefits from having stable product catalog first.
- Image compression should ship early (Phase 1) because it reduces data cost immediately.

## Validation / Success Metrics
- Time-to-first-sale < 24h for new shops.
- Order completion rate > 85%.
- Average browse session < 2 MB on 3G.
- 7-day seller retention > 60%.
- PWA install rate > 15% of mobile visits.

## Out of Scope (explicit)
- Desktop-only redesign (per existing constraint).
- Non-marketplace pillars (chat calling, statuses, looking-for) unless directly gating orders.
- Custom logistics fleet build — use local courier APIs only.
