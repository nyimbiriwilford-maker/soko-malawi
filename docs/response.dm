Done. Merged wip/lf-cards-v3 to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: Home now renders the shared LookingForRequestCard (redesigned card) instead of the old inline lfr-card markup; removed unused inline CSS.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-DwnrZsd4.js (Home chunk /assets/Home-7Bk13v06.js contains LookingForRequestCard)
- live sw.js: const CACHE_VERSION = 'sokomw-v38'

git log --oneline -3:
e28ebf9 Merge wip/lf-cards-v3
6b2b0e4 WIP: update response.dm
d5b54f7 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
