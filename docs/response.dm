TASK: Status page on phone shows white blank page. Console errors: profiles 400 (Bad Request) with district/location/address columns, services 504 (Gateway Timeout), beforeinstallprompt banner warning, web-vitals startTime TypeError.

ROOT CAUSES:
1. profiles table has NO district / location / address columns (verified across all supabase/migrations — none ever added them). Client code selecting those columns gets a hard 400 from PostgREST:
   - ServicesPage.jsx:671 (id, full_name, avatar_url, account_type, district) — the exact 400 seen on the phone.
   - StoryComposer.jsx:83 (city, district) — runs when posting a status.
   - The location,address variant in docs/console.md is from an older deploy; its source path was already removed.
2. services 504 is the app's own service worker (public/sw.js) fallback response when the network fails and nothing is cached — expected offline behaviour, but the deeper problem: the SW caches '/' and '/index.html' at install and never re-fetches them. After a new Vercel deploy purges old hashed bundles, a phone can be served the STALE cached shell that references /assets/index-<old-hash>.js which no longer exists → module fetch fails → blank white page. The auth-gate fix from the previous deploy couldn't help because the page never booted at all.
3. beforeinstallprompt warning and the VM30 web-vitals "startTime" TypeError are third-party noise — harmless, not related to the blank page.

FIXES:
A. src/pages/ServicesPage.jsx — provider profile fetch now falls back to safe columns (id, full_name, avatar_url, account_type) when the district select 400s; provider cards still render with shop name and city.
B. src/components/StoryComposer.jsx — status composer now selects city only (profiles has no district) and swallows profile fetch failures; location prefill still works.
C. public/sw.js —
   1. Cache bumped sokomw-v9 → v10 (activates the new SW on every phone).
   2. On activate: after purging old caches, re-fetches /index.html with cache:'reload' and re-caches a FRESH shell, so a stale shell can never outlive a deploy.
   3. Navigate fallback: when online, serves the network shell first; cached shell only when actually offline.
D. src/main.jsx — stale-shell self-heal: a capture-phase 'error' listener detects failed /assets/*.js|css loads (purged bundle referenced by stale shell) and reloads the page once per 15s window (sessionStorage guard prevents reload loops while a deploy propagates). Flag auto-clears after the page loads fine for 15s.

NOT FIXED (intentionally): beforeinstallprompt banner (Chrome PWA heuristic, informational), web-vitals startTime TypeError (injected analytics code, no app impact).

VERIFIED:
- npx eslint on the three edited files — all remaining errors/warnings pre-exist on master (confirmed via git stash baseline); no new issues introduced.
- npm run build — success.

DEPLOY: committed and pushed to master (Vercel auto-deploys). NOTE for the phone: after deploy, open the app once with network ON — the new SW (sokomw-v10) activates, clears the stale shell cache, and the blank page is gone for good. If it was installed as a PWA, launch it once while online to let the SW update.
