TASK: Status page opens and closes, showing a blank white screen. Fix it.

ROOT CAUSE:
- The /status route is only reachable when App.jsx has already confirmed a session (authed), but the StatusPage auth gate re-validated with supabase.auth.getUser() — a network round-trip to the auth server. On a slow or flaky connection that call hung for seconds while the gate rendered null (blank white page), and if it failed, the gate navigated to /login — which App.jsx immediately redirected back (session still exists locally) — producing the "opens and closes" bounce.

FIX in src/pages/StatusPage.jsx (auth gate):
1. Instant local session check — the gate now uses supabase.auth.getSession() (reads the local auth store, no network) like App.jsx and Home.jsx do. The page renders immediately for a signed-in user; no server round-trip in the critical path.
2. No more blank white — while gating, a branded spinner ("Loading statuses…", green ring on the SokoMw off-white background) shows instead of an empty white screen.
3. No bounce loop — /login redirects now use { replace: true } so a signed-out user doesn't get a back-button trap; profile enrichment stays fully non-blocking (page renders with the raw auth user instantly, profile fields merge in when the query returns).
4. Cancellation-safe on unmount/navigation (no setState after unmount).

VERIFIED:
- npx eslint src/pages/StatusPage.jsx — 2 pre-existing warnings only (0 errors, no new issues).
- npm run build — success.
