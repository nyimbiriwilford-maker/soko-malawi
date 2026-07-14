# Profile Dashboard Backend — Supabase Migration

Migration file:

`supabase/migrations/20260712_profile_dashboard_backend.sql`

This adds the database layer for every **placeholder / future** feature introduced in the premium Profile UI (Overview, Selling, Sold, Trust, Network), without changing existing app logic until you wire RPCs in the frontend.

## Apply

### Option A — Supabase Dashboard
1. Open **SQL Editor**
2. Paste and **Run** the full contents of  
   `supabase/migrations/20260712_profile_dashboard_backend.sql`

### Option B — CLI
```bash
supabase db push
```

Safe / idempotent: uses `IF NOT EXISTS`, `CREATE OR REPLACE`, and guards for missing tables.

---

## What was added

### Listings analytics & sold metadata
| Column | Purpose |
|--------|---------|
| `listings.view_count` | Denormalized detail views |
| `listings.save_count` | Denormalized saves |
| `listings.sold_at` | Set automatically when `status → sold` |
| `listings.sold_price` | Snapshot of sale price |
| `listings.boost_until` | Boost/featured window end |
| `listings.delivery_status` | Post-sale delivery lifecycle |

**Trigger:** `trg_listings_set_sold_at` — auto `sold_at` on mark sold; clears on relist.

### Tracking tables
| Table | UI feature |
|-------|------------|
| `listing_views` | Selling card “views” |
| `listing_saves` | Selling card “saves” |
| `profile_views` | Overview “Profile views” KPI |
| `user_blocks` | Network **Block user** |
| `shop_invites` | Network **Invite to shop** |
| `sale_orders` | Sold **Invoice / Receipt / Delivery** |
| `sale_reviews` | Sold **Buyer review** |
| `listing_boosts` | Selling **Boost listing** |
| `chat_response_events` | Trust **Fast Responder** |
| `achievement_definitions` + `user_achievements` | Trust **Achievements** |
| `trust_events` | Trust **Timeline** (persisted events) |
| `seller_daily_stats` | Overview **analytics charts** |

### RPCs (callable from the client)

| Function | Use |
|----------|-----|
| `record_listing_view(listing_id, session_key?)` | Detail open |
| `toggle_listing_save(listing_id)` | Save/unsave |
| `record_profile_view(profile_id, session_key?, source?)` | Public profile open |
| `get_seller_dashboard_stats(user_id?)` | Overview + Sold KPIs |
| `get_seller_analytics_series(days?, user_id?)` | Charts series |
| `recompute_seller_day_stats(seller_id, day?)` | Daily rollup |
| `bulk_update_listing_status(ids[], status)` | Bulk sold/relist |
| `bulk_delete_listings(ids[])` | Bulk delete |
| `apply_listing_boost(listing_id, days, type?, payment_ref?)` | Boost |
| `create_sale_order_from_listing(listing_id, buyer_id?, amount?)` | Invoice row |
| `update_sale_delivery_status(order_id, status)` | Delivery |
| `block_user(blocked_id, reason?)` / `unblock_user` | Block |
| `record_chat_response(chat_id, inbound_at, replied_at?)` | Response time |
| `recompute_user_achievements(user_id?)` | Unlock badges |
| `unlock_achievement(user_id, achievement_id, meta?)` | Manual unlock |
| `log_trust_event(user_id, type, title, meta?, related_id?)` | Timeline |
| `get_people_you_may_know(limit?)` | Network suggestions |
| `ensure_direct_chat(other_user_id)` | Open/create DM (if `chats` schema matches) |

---

## Frontend wiring (next steps)

These are **not** required to apply the migration. Wire when ready:

```js
// Profile views KPI
await supabase.rpc('record_profile_view', { p_profile_id: sellerId, p_session_key: sessionId })

// Listing views on detail page
await supabase.rpc('record_listing_view', { p_listing_id: listingId })

// Dashboard KPIs
const { data } = await supabase.rpc('get_seller_dashboard_stats')

// Network suggestions
const { data: people } = await supabase.rpc('get_people_you_may_know', { p_limit: 12 })

// Bulk mark sold
await supabase.rpc('bulk_update_listing_status', {
  p_listing_ids: selectedIds,
  p_status: 'sold',
})

// Achievements refresh
await supabase.rpc('recompute_user_achievements')
```

### Suggested UI → RPC map

| UI control | RPC / table |
|------------|-------------|
| Overview Profile views | `record_profile_view` + `get_seller_dashboard_stats` |
| Selling views/saves badges | `record_listing_view` / `toggle_listing_save` + `listings.view_count/save_count` |
| Sold sales rate / avg age | `get_seller_dashboard_stats` |
| Boost button | `apply_listing_boost` (after payment) |
| Bulk bar | `bulk_update_listing_status` / `bulk_delete_listings` |
| Buyer review | `sale_reviews` insert |
| Delivery status | `update_sale_delivery_status` |
| Invoice / receipt | `sale_orders.invoice_number` / `receipt_url` |
| Fast Responder | `record_chat_response` on reply |
| Achievements | `recompute_user_achievements` |
| People you may know | `get_people_you_may_know` |
| Block | `block_user` |
| Invite to shop | insert `shop_invites` |
| Send message | `ensure_direct_chat` then navigate `/chats` |

---

## Notes / compatibility

- **`is_admin()`** must exist (from `20260711_security_hardening.sql`). If you never ran that migration, run it first.
- **`deal_confirmations` status values** in RPCs use `confirmed` / `completed` / `done` — adjust filters if your statuses differ.
- **`ensure_direct_chat`** tries `chats.user1` / `user2`. If your chats schema differs, adapt or skip that function.
- **Early Adopter** unlock cutoff is `2026-01-01` — change in `recompute_user_achievements` if needed.
- RLS is enabled on new tables; owners/sellers can read their analytics; public can insert views.

---

## Rollback (optional)

Only if you need a full teardown (destructive):

```sql
-- Drop RPCs (example)
DROP FUNCTION IF EXISTS public.get_seller_dashboard_stats(uuid);
DROP FUNCTION IF EXISTS public.get_people_you_may_know(integer);
-- …etc

-- Drop tables
DROP TABLE IF EXISTS public.seller_daily_stats CASCADE;
DROP TABLE IF EXISTS public.trust_events CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.achievement_definitions CASCADE;
-- …etc
```

Prefer leaving the migration in place and only removing unused RPCs.
