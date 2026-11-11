Services phase 4 complete.

Report (before edits):
- Empty state: .svc-empty with Search icon 32px #9aa0a6, "No services found"/"Try another category or city", Clear filters button 40px resetting only cat/city/search.
- Error handling: none (loadServices had no try/catch/error state).
- My Services tab: tab==='mine' using ServiceCard isMine, empty state "No services found" + "List Service" button.
- Counters: services.views exists (DB column, default 0); no chats counter field. Edit/Pause: active page only had onEdit -> "Manage"; no Pause/Activate in active page (exists only in legacy services/MyListings.jsx as toggleStatus).

Changes: added error/empty/offline/low-supply states; debounced search 250ms + URL filter persistence; focus rings, reduced-motion; counters row (views only, since chats absent) in My Services; updated empty state text; title/meta; sw cache v19->v20.

Build: OK. Lint: OK.
git log --oneline -3:
a151ed2 Services phase 3: cards and grid
545decc Services phase 2: mobile-first controls
b9725d0 Services phase 1: hero, search, segmented, remove posting controls
git status -sb:
 M dist/index.html
 M public/sw.js
 M public/version.json
 M src/pages/ServicesPage.jsx

Vercel: not deployed from this working tree (not committed/pushed). Production sw.js still sokomw-v19; index still index-LLOq0Ovh.js.