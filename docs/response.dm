# CSP: add R2 domains (applied)

## CSP location
Checked in this order:
1. `vercel.json` — **headers present here** (Content-Security-Policy at line 35). ◀ adopted
2. `index.html` — no `<meta http-equiv="Content-Security-Policy">` tag present.
3. `vite.config.js` — no headers/CSP config present.

## Change
Updated only the `Content-Security-Policy` value in `vercel.json`.

### Before
```
default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://api.africastalking.com https://api.brevo.com https://api.bigdatacloud.net; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

### After
```
default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: https://*.r2.dev; media-src 'self' blob: https://*.supabase.co https://pub-67bc811f19044f60bd6fb142f7280dcf.r2.dev https://*.r2.dev; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://api.africastalking.com https://api.brevo.com https://api.bigdatacloud.net https://*.r2.cloudflarestorage.com https://*.r2.dev; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

## What changed (diff summary)
- `media-src` → added `https://pub-67bc811f19044f60bd6fb142f7280dcf.r2.dev` and `https://*.r2.dev`
- `connect-src` → added `https://*.r2.cloudflarestorage.com` and `https://*.r2.dev`
- `img-src` → added `https://*.r2.dev` (explicit; the existing `https:` wildcard already allowed it, added explicitly for mobile listing images)

## Verification
- `npm run build`: **passes** (5.08s, 2103 modules transformed).