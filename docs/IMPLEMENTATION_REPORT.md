# Phase 14 — Implementation Report

**SokoMw Profile activation + complete Supabase migrations**  
Date: 2026-07-13  
Scope: Full Profile module audit, live frontend wiring, ordered migrations `001`–`011`, storage, RLS.

---

## Executive summary

Phase 14 completes the backend contract and frontend wiring for every Profile UI surface that previously used placeholders or client-only composition. Migrations are production-oriented (idempotent `IF NOT EXISTS` / `CREATE OR REPLACE` / guarded `DO` blocks). The React Profile page now soft-calls Supabase RPCs and tables so the UI works before and after you run SQL.

**UI design is preserved.** Business logic for listings, follows, vouch/trust, auth, and verification payment flow is retained and extended—not rewritten.

---

## How to apply migrations

Run **in order** in the Supabase SQL Editor (or `supabase db push`):

| Order | File |
|------:|------|
| 1 | `supabase/migrations/20260713_001_profiles_updates.sql` |
| 2 | `supabase/migrations/20260713_002_trust_system.sql` |
| 3 | `supabase/migrations/20260713_003_profile_analytics.sql` |
| 4 | `supabase/migrations/20260713_004_recent_activity.sql` |
| 5 | `supabase/migrations/20260713_005_achievements.sql` |
| 6 | `supabase/migrations/20260713_006_notifications.sql` |
| 7 | `supabase/migrations/20260713_007_security.sql` |
| 8 | `supabase/migrations/20260713_008_storage.sql` |
| 9 | `supabase/migrations/20260713_009_indexes.sql` |
| 10 | `supabase/migrations/20260713_010_rls_policies.sql` |
| 11 | `supabase/migrations/20260713_011_verification_lookups.sql` |

Optional legacy monolith (superseded by 001–011 split):  
`20260712_profile_dashboard_backend.sql` — **do not re-run** if 001–011 are applied (overlap is mostly safe but redundant).

---

## Features previously incomplete → how implemented

| Feature | Before | After |
|---------|--------|--------|
| **Profile views KPI** | `"—"` / placeholder | `get_seller_dashboard_stats` + `profiles.profile_view_count`; `record_profile_view` on public profile |
| **Listing views / saves / shares** | Not tracked | Tables + RPCs; share increments via `record_listing_share` on share action |
| **Sold KPIs (rate, avg age)** | Local-only / “Placeholder” labels | RPC `sales_rate_pct`, `avg_listing_age_days` with listing fallback; `sold_at` trigger |
| **Analytics chart** | Fake bars | `get_seller_analytics_series` → live bar heights when `seller_daily_stats` has data |
| **Activity timeline** | Composed from listings only | Merges `marketplace_activity` via `get_recent_activity` + listing triggers |
| **Trust timeline** | Client-only | Prefers `trust_events`; sales log via activity/trust triggers |
| **Achievements** | Hardcoded + 2 placeholders | `recompute_user_achievements` + `get_user_achievements`; client fallback uses `fast_responder` / join date |
| **Fast responder checklist** | Always incomplete | Uses `profiles.fast_responder` / avg response fields from chat response RPC |
| **People you may know** | 3 placeholder cards | `get_people_you_may_know` 2nd-degree follows + Follow action |
| **Block user** | Disabled | `block_user` RPC (also removes follows) |
| **Invite to shop** | Disabled | Inserts `shop_invites` when user owns a shop |
| **Message from network** | Disabled | Navigates to `/chats?with={id}` |
| **Bulk mark sold / relist / delete** | Disabled | `bulk_update_listing_status` / `bulk_delete_listings` + row fallback |
| **Bulk / single boost** | Disabled | Writes `listing_boosts` + sets `boost_until` / featured flags (7 days) |
| **Sold invoice / receipt / delivery / reviews** | Disabled | `sale_orders` ensure + cycle delivery; receipt download; review list |
| **Recommended listings** | Placeholder tiles | Live active listings from other sellers |
| **Recently viewed** | Empty forever | `listing_views` for current user → listing cards |
| **Job / service buyer stats** | Always “Soon” | Soft-count `job_applications` / `service_requests` when tables exist |
| **Account sessions / security** | Placeholder rows | `user_sessions` touch on profile open; session count + last security event |
| **Password manage** | Disabled | Links to `/reset-password` |
| **Cover photo storage** | Always `avatars` bucket | Prefers `covers` bucket, falls back to `avatars` |
| **Profile completion cache** | Client-only | Syncs `profile_completion_pct` + seller level columns |
| **Seller level** | Client points formula | Still computed client-side; cached to `seller_level_tier` / `seller_level_name` |
| **Verification** | Modal + payment | Tables for requests/documents ensured in `011` |
| **Saved searches / reports / referrals** | Missing schema | Created in `011` + RPCs for immediate frontend use |

---

## Frontend files changed

| File | Role |
|------|------|
| `src/hooks/useProfileDashboard.js` | **New** — dashboard stats, series, achievements, activity, trust events, sessions, suggestions, recommended, recently viewed, soft job/service counts, share/block/bulk helpers |
| `src/pages/Profile.jsx` | Wired all Profile tabs to hook + RPCs; network actions; bulk bar; cover bucket; live achievements/timeline/analytics |
| `src/pages/PublicProfile.jsx` | Calls `record_profile_view` on load |
| `src/pages/ListingDetail.jsx` | Calls `record_listing_view` on load |

---

## Database changes by migration

### 001 — Profiles updates
**New columns on `profiles` (IF NOT EXISTS):**  
`cover_url`, `phone`, `city`, `account_type`, `last_seen`, `profile_view_count`, `profile_completion_pct`, `avg_response_seconds`, `response_sample_count`, `fast_responder`, `seller_level_tier`, `seller_level_name`, `last_login_at`, `email`

**Helpers:** `_soko_table_exists`, `_soko_column_exists`

### 002 — Trust system
**Tables:** `trust_events`, `sale_orders`, `sale_reviews`  
**Alters:** `trust_scores.total_score`, `trust_scores.updated_at` (or creates `trust_scores`)  
**Functions:** `log_trust_event`, `is_admin`

### 003 — Profile analytics
**Tables:** `profile_views`, `listing_views`, `listing_saves`, `listing_shares`, `seller_daily_stats`  
**Listing columns:** `view_count`, `save_count`, `share_count`, `sold_at`, `sold_price`, `boost_until`, `delivery_status`  
**Trigger:** `trg_listings_set_sold_at` → `listings_set_sold_at()`  
**RPCs:**  
`record_profile_view`, `record_listing_view`, `record_listing_share`, `toggle_listing_save`,  
`get_seller_dashboard_stats`, `get_seller_analytics_series`

### 004 — Recent activity
**Table:** `marketplace_activity`  
**RPCs:** `log_marketplace_activity`, `get_recent_activity`  
**Trigger:** `trg_listings_activity` → logs create/sold/relist; calls `log_trust_event` on sale

### 005 — Achievements
**Tables:** `achievement_definitions`, `user_achievements`  
**Seed catalog:** verified, trusted, active, fast, community, top, early  
**RPCs:** `unlock_achievement`, `recompute_user_achievements`, `get_user_achievements`

### 006 — Notifications
Ensures `notifications` table + columns (`type`, `title`, `body`, `link`, `read`, `meta`, `created_at`)  
**Index:** unread by user  
**RPC:** `get_unread_notification_count`

### 007 — Security & network ops
**Tables:** `user_blocks`, `user_sessions`, `security_events`, `shop_invites`, `listing_boosts`, `chat_response_events`  
**RPCs:** `block_user`, `unblock_user`, `get_people_you_may_know`, `bulk_update_listing_status`, `bulk_delete_listings`, `record_chat_response`, `log_security_event`

### 008 — Storage
**Buckets:**  
| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | yes | Profile photos |
| `covers` | yes | Cover photos |
| `verification-docs` | **no** | ID / verification files |
| `shop-images` | yes | Shop media |
| `listing-images` | yes | Listing media |

**Policies:** owner folder = `auth.uid()::text` first path segment; public read on public buckets

### 009 — Indexes
Performance indexes on profiles, listings, follows, deals, messages, buyer_requests, saved_statuses, sale_orders, listing_saves/shares

### 010 — RLS policies
Enables RLS + SELECT/INSERT/UPDATE/DELETE policies for all new dashboard tables; uses `is_admin()` where appropriate

### 011 — Verification & lookups
**Tables:**  
`verification_requests`, `verification_documents`, `user_reports`, `referrals`, `saved_searches`, `profile_completion_events`  
**Profile column:** `referral_code`  
**RPCs:** `ensure_referral_code`, `report_user`, `save_search`  
**RLS:** owner/admin scoped

---

## New tables (complete list)

1. `trust_events`  
2. `sale_orders`  
3. `sale_reviews`  
4. `profile_views`  
5. `listing_views`  
6. `listing_saves`  
7. `listing_shares`  
8. `seller_daily_stats`  
9. `marketplace_activity`  
10. `achievement_definitions`  
11. `user_achievements`  
12. `user_blocks`  
13. `user_sessions`  
14. `security_events`  
15. `shop_invites`  
16. `listing_boosts`  
17. `chat_response_events`  
18. `verification_requests`  
19. `verification_documents`  
20. `user_reports`  
21. `referrals`  
22. `saved_searches`  
23. `profile_completion_events`  
24. `notifications` *(created only if missing)*  
25. `trust_scores` *(created only if missing)*

---

## New / altered columns

### `profiles`
`cover_url`, `phone`, `city`, `account_type`, `last_seen`, `profile_view_count`, `profile_completion_pct`, `avg_response_seconds`, `response_sample_count`, `fast_responder`, `seller_level_tier`, `seller_level_name`, `last_login_at`, `email`, `referral_code`

### `listings`
`view_count`, `save_count`, `share_count`, `sold_at`, `sold_price`, `boost_until`, `delivery_status`

### `trust_scores`
`total_score`, `updated_at`

### `notifications`
`type`, `title`, `body`, `link`, `read`, `meta`, `created_at` (when table already existed)

---

## Triggers

| Trigger | Table | Function |
|---------|-------|----------|
| `trg_listings_set_sold_at` | `listings` | `listings_set_sold_at` |
| `trg_listings_activity` | `listings` | `trg_log_listing_activity` |

---

## Functions / RPCs

| Function | Purpose |
|----------|---------|
| `_soko_table_exists` / `_soko_column_exists` | Safe migration helpers |
| `is_admin` | RLS admin check via `profiles.role` |
| `log_trust_event` | Trust timeline row |
| `record_profile_view` | Throttled profile view + counter |
| `record_listing_view` | Throttled listing view + counter |
| `record_listing_share` | Share log + counter |
| `toggle_listing_save` | Save/unsave + counter |
| `get_seller_dashboard_stats` | Overview / Sold KPIs JSON |
| `get_seller_analytics_series` | Daily series for charts |
| `log_marketplace_activity` | Activity feed insert |
| `get_recent_activity` | Activity feed read |
| `listings_set_sold_at` | Trigger body for sold_at |
| `trg_log_listing_activity` | Trigger body for activity/trust |
| `unlock_achievement` | Grant badge |
| `recompute_user_achievements` | Derive unlocks from live signals |
| `get_user_achievements` | Catalog + unlock state |
| `get_unread_notification_count` | Badge count |
| `block_user` / `unblock_user` | Network block |
| `get_people_you_may_know` | Suggestions |
| `bulk_update_listing_status` | Bulk sold/active |
| `bulk_delete_listings` | Bulk delete |
| `record_chat_response` | Response-time samples → `fast_responder` |
| `log_security_event` | Security audit |
| `ensure_referral_code` | Referral code seed |
| `report_user` | Abuse report |
| `save_search` | Saved search row |

---

## Storage buckets

- `avatars` (public)  
- `covers` (public)  
- `verification-docs` (private)  
- `shop-images` (public)  
- `listing-images` (public)  

Folder convention: `{user_id}/filename.ext`

---

## RLS policies (summary)

- **Owner read/write** for sessions, security events (own), achievements (own unlocks), saves, boosts, invites (party), verification docs/requests, saved searches, completion events, reports (reporter insert/select).  
- **Public/authenticated insert** for views/shares (tracking).  
- **Owner select** on profile_views (profile owner) and listing analytics (seller).  
- **trust_events** select open; insert own.  
- **achievement_definitions** readable (via policies in 010).  
- **Storage:** public read on public buckets; write/delete only own folder.

See `010_rls_policies.sql` and `011_verification_lookups.sql` for exact policy names.

---

## Indexes (summary)

- `profile_views(profile_id, created_at DESC)`  
- `listing_views(listing_id, created_at DESC)`  
- `user_achievements(user_id, unlocked_at DESC)`  
- `marketplace_activity(user_id, created_at DESC)`  
- `trust_events(user_id, created_at DESC)`  
- `user_blocks(blocker_id)`, `user_sessions(user_id, last_active_at)`  
- `security_events(user_id, created_at DESC)`  
- `notifications` partial unread index  
- Listing/seller/deal/message indexes in `009`

---

## Manual steps in Supabase (after SQL)

1. **Run migrations 001→011** in the SQL Editor (or CLI push).  
2. **Storage:** Confirm buckets appear under Storage. If `008` errors on `storage.buckets`, create buckets manually with the same names and re-run only the policy statements from `008`.  
3. **Edge functions:** Verification still depends on `initiate-payment` function + PayChangu config (existing).  
4. **Optional daily rollup:** Populate `seller_daily_stats` via cron or a future `recompute_seller_day_stats` job so analytics bars fill historically. Until then, totals still show from counters.  
5. **Chat response sampling:** Call `record_chat_response` from Chat send handlers when you wire message timestamps (schema ready).  
6. **Auth redirect:** Ensure `/reset-password` route is live for Account → Manage password.  
7. **Admin role:** Set `profiles.role = 'admin'` for staff who need admin RLS paths.  
8. **Recompute achievements** for existing users (optional one-shot):
   ```sql
   SELECT public.recompute_user_achievements(id) FROM public.profiles;
   ```
9. **Test as authenticated user:** open Profile → Overview (profile views), Network (suggestions), Selling select-mode bulk, public profile (view count), listing detail (view count).

---

## Soft-fail behavior

If migrations are **not** applied yet:

- Profile still loads listings, follows, vouch data, completeness, seller level.  
- RPCs fail silently; KPIs fall back to local counts / client achievement formula.  
- Bulk ops fall back to per-row `update`/`delete`.  
- Cover upload falls back to `avatars` bucket.

After migrations, the same UI lights up with live counters, achievements, sessions, and suggestions without further code changes.

---

## Out of scope / intentional remaining “soon”

These UI affordances still need **product** decisions beyond schema (tables exist where noted):

- **Delete account** / **Download my data** — destructive compliance flows; buttons remain gated.  
- **Paid boost checkout** — boost rows can be written; payment provider not wired in bulk Boost.  
- **Full DM create-or-open chat RPC** — message button deep-links to chats; ensure Chat list handles `?with=`.  
- **Personalized ML recommendations** — current recommended = recent marketplace listings.  
- **Job applications / service requests counts** — require those domain tables to exist with expected columns.

---

## Verification checklist (post-deploy)

- [ ] Migrations 001–011 succeed without error  
- [ ] Storage buckets visible  
- [ ] `get_seller_dashboard_stats` returns JSON in SQL Editor  
- [ ] Public profile increments `profile_view_count`  
- [ ] Listing detail increments `view_count`  
- [ ] Profile → Overview shows profile views when non-zero  
- [ ] Profile → Trust → Achievements unlock after recompute  
- [ ] Profile → Network → Block / Follow suggestion works  
- [ ] Selling multi-select Mark sold / Delete works  
- [ ] Cover upload stores under `covers/{uid}/…`  
- [ ] Sign out still works  

---

## Related docs

- `docs/PROFILE_DASHBOARD_BACKEND.md` — earlier monolith notes  
- `docs/SECURITY_HARDENING.md` — prior security pass  

---

*End of Phase 14 implementation report.*
