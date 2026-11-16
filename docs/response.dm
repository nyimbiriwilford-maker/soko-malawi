Done. Merged wip/home-shops-v2 to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: Trusted Shops redesigned (new ts-card with cover/logo/body/meta, rail on phone/tablet with See all shops tile, 4-col grid on laptop with outline See all shops button, load 8 shops, skeleton, empty hides section, removed discover strip).

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-Cq8ArdmU.js
- live sw.js: const CACHE_VERSION = 'sokomw-v46'

git log --oneline -3:
68bb8a9 WIP: update response.dm
bfe8032 Merge wip/home-shops-v2
8870f89 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
