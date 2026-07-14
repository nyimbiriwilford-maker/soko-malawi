# Phase 1 — Verification Foundation

## Run these migrations (in order)

1. `supabase/migrations/20260714_100_verification_foundation.sql`
2. `supabase/migrations/20260714_101_verification_rls_indexes.sql`

If you already ran older `011` verification files, these still apply safely (idempotent upgrades).

## Status lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Started, not submitted |
| `submitted` | Application submitted |
| `payment_pending` | Awaiting PayChangu payment |
| `payment_confirmed` | Payment verified |
| `under_review` | In admin queue (default after pay) |
| `additional_info_required` | Admin requested more info |
| `approved` | Badge granted (`profiles.is_verified = true`) |
| `rejected` | Denied |
| `expired` | Request timed out |
| `cancelled` | User cancelled / payment cancelled |

## Tables

- **`verification_types`** — seller / shop / business catalog  
- **`verification_settings`** — singleton fee, review hours, docs, payment methods  
- **`verification_setting_kv`** — optional key/value overrides  
- **`verification_requests`** — pipeline (upgrades existing table)  
- **`verification_status_events`** — audit log of transitions  

## Profiles columns

- `verification_status`, `verification_level`, `verified_at`, `verified_by`  
- `verification_expiry`, `rejection_reason`, `verification_request_id`  
- **`is_verified`** kept for all existing UI  

Triggers sync `is_verified` + shops when request status becomes `approved`.

## Configurable settings (no hardcoding)

Update row `id = 1` in `verification_settings`:

```sql
UPDATE public.verification_settings SET
  fee_amount = 5000,
  fee_currency = 'MWK',
  review_period_hours = 24,
  accepted_document_types = ARRAY['national_id','passport','selfie'],
  supported_payment_methods = ARRAY['pachangu','airtel_money','tnm_mpamba'],
  auto_submit_on_payment = true,  -- true → under_review after pay
  is_enabled = true
WHERE id = 1;
```

## App flow (after Phase 1)

1. Modal reads fee/settings via `get_verification_settings`  
2. Pay → `start_verification_payment` → status `payment_pending`  
3. PayChangu return → `confirm_verification_payment` → `under_review` (**not** approved)  
4. Admin Approve / Reject / Need info → badge only on **approved**  

## RPCs

- `get_verification_settings()`  
- `get_active_verification_types()`  
- `start_verification_payment(ref, method, type_code)`  
- `confirm_verification_payment(tx_ref)`  
- `transition_verification_status(request_id, status, note, …)`  
