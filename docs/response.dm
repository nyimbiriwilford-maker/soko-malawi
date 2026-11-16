Done. Merged wip/lf-home-card-open to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: LookingFor page now reads ?request=<id> from URL and opens the same details modal. Home card click navigates to /looking-for?request=<id>, so the request opens. Temporary console.log added then removed; grep for lf-card-open returns 0.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-Cg4ZdA3B.js
- live sw.js: const CACHE_VERSION = 'sokomw-v45'

git log --oneline -3:
162b126 WIP: update response.dm
27b242e Merge wip/lf-home-card-open
e91216b WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
