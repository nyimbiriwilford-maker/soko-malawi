# Phase 3 — Verification Payment System

## Migration

Run in Supabase SQL Editor:

```
supabase/migrations/20260714_103_verification_payments.sql
```

Requires Phase 1 tables (`verification_requests`, `verification_settings`) already applied.

## Tables

### `verification_payment_methods`
Catalog of rails:

| code | channel | auto-confirm |
|------|---------|--------------|
| `pachangu` | gateway | yes (API) |
| `airtel_money` | mobile_money | manual admin |
| `tnm_mpamba` | mobile_money | manual admin |
| `bank_transfer` | bank | manual admin |
| `card` | card | manual until gateway |
| `other` | other | manual |

### `verification_payments`
Ledger fields:

- `payment_method`, `payment_amount`, `currency`
- `transaction_reference`, `payment_date`, `payment_status`
- `gateway`, `gateway_session_id`, `gateway_payload` (future APIs)
- `receipt_path`, `receipt_file_name`
- `verified_by_admin`, `admin_notes`, `confirmed_at`

Statuses: `pending` → `initiated` → `awaiting_confirmation` → `confirmed` | `failed` | `cancelled` | `refunded` | `expired`

## RPCs

| Function | Who |
|----------|-----|
| `get_verification_payment_methods()` | Public/auth |
| `create_verification_payment(...)` | Seller |
| `submit_verification_payment_proof(...)` | Seller |
| `admin_confirm_verification_payment(...)` | Admin |
| `admin_reject_verification_payment(...)` | Admin |
| `confirm_verification_gateway_payment(...)` | Seller after PayChangu |
| `get_verification_payments_for_request(...)` | Seller/admin |

## Flow

1. **PayChangu:** wizard creates payment (`initiated`) + checkout → return → gateway confirm → request `under_review`
2. **Manual (Airtel/Mpamba/Bank/Card):** seller enters tx ID (+ optional receipt) → `awaiting_confirmation` → **Admin → Confirm payment** → request advances → then Approve seller for badge

## Admin UI

Verifications tab shows payment status and **Confirm payment / Reject payment** when awaiting confirmation.

## Future gateways

Add a row to `verification_payment_methods` with `supports_auto_confirm = true` and call `confirm_verification_gateway_payment` from the webhook/return handler with `p_gateway = 'your_provider'`.
