Services phase 6A complete.

Report (before edits):
1. git status: only docs/response.dm modified; log top: ae10a80 phase5, 7730cc1 phase4, a151ed2 phase3; sw cache version sokomw-v21.
2. services fields: status (yes), title (no, uses name), description (yes), price (no, uses rate), image (no, uses media_urls), category (yes), city (yes), region/district (no on service; profile.city exists), provider id (provider_id yes), verified (yes), created_at (yes), rating (yes), completed count (jobs_done yes), views (yes), chats (no), is_featured (no).
3. User city: profile.city for logged-in; localStorage 'soko_city' for guests (none existed; now saved on city pick).
4. Sort state: sortBy; phone sheet + laptop dropdown in ServicesPage.jsx.

Implementation:
- src/lib/serviceRanking.js: rankServices(services, ctx) with hiding, scoring, boost, seeded shuffle, diversity pass.
- Weights: location 0.30, quality 0.20, verified 0.15, engagement 0.15, freshness 0.10, completeness 0.10. New-provider boost +0.10.
- Fields falling back to neutral: title->name, price->rate, image->media_urls, region/district (0.2, no match), chats (engagement 0.5), rating/count (quality 0.5 when no rating data), userCity unknown (location 0.5).
- Added Recommended sort first/default in both sheets; search title matches before description matches; seed in sessionStorage 'soko_svc_seed'.

Build: OK. Lint: OK (pre-existing warning only).
git log --oneline -3:
8256372 Services phase 6A: ranking and Recommended sort
ae10a80 Services phase 5: featured rail and visibility
7730cc1 Services phase 4: states, My Services tab, polish
Vercel: deployed — sw.js sokomw-v22, index-LHQlT2Z-.js.