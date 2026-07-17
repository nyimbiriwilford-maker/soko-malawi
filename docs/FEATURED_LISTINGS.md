# Featured listings

How homepage / search spotlight works, Phase 0 stabilisation, and remote RPCs the app expects.

## Who may grant featured (after Phase 0)

| Path | Sets flags? | Notes |
|------|-------------|--------|
| **Free feature RPC** `request_feature_listing` | Yes (server) | Only when free slots remain + global toggle |
| **Paid confirm** `confirm_feature_payment` | Yes (server) | After PayChangu success (`SOKO-FEATURE-*` tx_ref) |
| **Admin panel** Featured tab | Yes (client update + `listing_promotions`) | Admin-granted, `price_mwk: 0` |
| **Post listing insert/update** | **No** | Phase 0: never writes `is_featured` / `featured` on publish |
| **Profile free boost** | **No** | Phase 0: disabled (toast only) |

## Client publish flow (`PostListing.jsx`)

1. Listing is inserted/updated as **published** without featured flags.
2. If seller chose **Featured Listing**:
   - Free: `request_feature_listing(listing_id, duration_days)` — RPC owns flags + promotion row.
   - Paid: `request_feature_listing_payment` → edge `initiate-payment` → PayChangu → `/verify-payment` → edge `verify-transaction` and/or `confirm_feature_payment`.
3. Other promotion SKUs (Basic / Top of Search / Premium) are not activated; user is told only Featured is available.

## Required remote RPCs / tables

These are **called by the app** but are not fully defined in this repo’s migrations (as of Phase 0). They must exist on the Supabase project (or be added in Phase 1 migrations).

| Name | Purpose |
|------|---------|
| `request_feature_listing(p_listing_id, p_duration_days)` | Activate free featured; enforce free limit + `free_featured_enabled` |
| `request_feature_listing_payment(p_listing_id, p_duration_days)` | Create pending promotion + `tx_ref` + `price` for checkout |
| `confirm_feature_payment(p_tx_ref)` | Mark paid promotion active; set listing featured flags + expiry |

| Table / setting | Purpose |
|-----------------|---------|
| `listing_promotions` | Free/paid/admin promotion ledger (`promotion_type`, `price_mwk`, `tx_ref`, `status`, dates) |
| `app_settings` key `free_featured_enabled` | Global free-feature toggle (Admin Featured tab) |
| `listings.featured` / `listings.is_featured` | Dual booleans still read by UI (Phase 2 will consolidate) |
| `listings.promoted_until` | Admin duration end (UI does not yet filter by it — Phase 2) |

Edge functions involved:

- `initiate-payment` — starts PayChangu checkout (`purpose: featured_listing`)
- `verify-transaction` — on confirmed `SOKO-FEATURE-*`, calls `confirm_feature_payment`

## Dual columns (temporary)

UI treats a listing as featured when **`featured || is_featured`**.  
Admin toggle sets **both**. PostListing no longer sets either on publish.

## Status vocabulary

| Surface | Live listing status |
|---------|---------------------|
| Home / marketplace | `published` |
| Admin (historical) | `active` |
| **Admin after Phase 0** | Live = `published` **or** `active` |

## Phase 0 checklist (done in code)

- [x] No `is_featured` / `featured` on publish `buildRow`
- [x] Feature only via free RPC success or paid confirm path
- [x] Profile free boost / bulk boost gated
- [x] FeaturedSection display-only (no half-column star toggle)
- [x] Admin live-status = published \| active
- [x] This document for required RPCs

## Out of scope (later phases)

- RLS blocking seller self-update of feature columns (Phase 1)
- Single `featured_until` + expiry jobs (Phase 2)
- Dedicated Home featured query (Phase 3)
- Full promotion catalog pricing cleanup (Phase 4)
