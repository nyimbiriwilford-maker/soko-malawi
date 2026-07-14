# SokoMw Security Hardening — Deploy Checklist

## 1. Apply database migration

In Supabase Dashboard → **SQL Editor**, run:

`supabase/migrations/20260711_security_hardening.sql`

Or CLI:

```bash
supabase db push
```

This enables:

- `otp_codes.code_hash`
- `profiles.email` + unique index
- RLS on app tables
- Privilege-escalation guard on `profiles.role` / `is_disabled`
- Auth trigger to sync email into `profiles`

**Note:** If a policy fails because a column name differs in your DB, adjust that policy only and re-run the rest.

## 2. Deploy edge functions

```bash
supabase functions deploy send-otp
supabase functions deploy verify-otp
```

### Edge secrets

```bash
supabase secrets set TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret
# Also ensure existing secrets:
# BREVO_API_KEY, AT_API_KEY, AT_USERNAME, SUPABASE_SERVICE_ROLE_KEY
```

- If `TURNSTILE_SECRET_KEY` is **not** set, captcha is skipped on the server (dev only).
- Always set it in production.

## 3. Frontend env (Vercel / local)

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TURNSTILE_SITE_KEY=your_cloudflare_site_key
```

Test keys (always pass) — development only:

| | Value |
|--|--|
| Site key | `1x00000000000000000000AA` |
| Secret | `1x0000000000000000000000000000000AA` |

## 4. Vercel headers

`vercel.json` includes CSP, HSTS, X-Frame-Options, etc. Redeploy the frontend for headers to apply.

## 5. After code_hash is proven in production

Remove dual-read of plaintext OTP in `verify-otp`, then:

```sql
UPDATE public.otp_codes SET code = NULL WHERE code_hash IS NOT NULL;
-- optional:
-- ALTER TABLE public.otp_codes DROP COLUMN code;
```

## 6. Verify RLS

```sql
-- As anon (should fail / empty for otp):
SET ROLE anon;
SELECT * FROM otp_codes;  -- expect deny or empty via policy
```

In Supabase Dashboard → Authentication → Policies, confirm policies exist per table.
