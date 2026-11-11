Services phase 5 complete.

STEP 1 REPORT (before edits):
1. services table columns (from live DB): available, category, city, contact, coverage, created_at, description, experience, id, jobs_done, media_urls, name, provider_id, rate, rating, skills, status, tags, verified, views, whatsapp. Missing: featured/is_featured/featured_until. Views column EXISTS (integer default 0). Verified, created_at exist. No chats column.
   Home featured query uses listings.is_featured/featured/featured_until (not services).
2. Admin marks listings featured via toggleFeatured() in src/pages/Admin.jsx, using RPCs admin_set_listing_featured / admin_unset_listing_featured. No admin handling for services.
3. Featured column missing, so wrote SQL file instead of running SQL; rail gated on presence of is_featured (hidden until SQL applied).

SQL file: /sql/services_visibility.sql
Contents:
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
notify pgrst, 'reload schema';

STEP 2-3:
- Added Featured Providers rail above toolbar/grid, shown only when is_featured column exists, >=2 qualifying (featured/verified) services, and no filters/search active.
- Order: featured flag first, then verified, then newest. Limit 8.
- Phone: horizontal swipe, 240px cards, gap 12px, scroll-snap, no scrollbar. Laptop: 280px cards, 40px left/right arrows, edge fades.
- Reused ServiceCard; Featured pill (#F9AB00/#202124) in place of New badge.
- Spacing 20/24/28px gap-based.
- Views: no record_service_view RPC exists; did not build (per instructions).
- Main grid unchanged (all services).

Build: OK. Lint: OK (pre-existing exhaustive-deps warning only).
git log --oneline -3:
ae10a80 Services phase 5: featured rail and visibility
7730cc1 Services phase 4: states, My Services tab, polish
a151ed2 Services phase 3: cards and grid
git status -sb:
 (clean after push)
Vercel: deployed — sw.js sokomw-v21, index-Gax9fTW6.js.