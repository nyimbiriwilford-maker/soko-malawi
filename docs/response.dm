Done. Merged wip/lf-cards-v2 to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Verification:
- Vercel: live at https://sokomw.com/ (updated bundle contains "People Looking For" + "See all requests")
- live bundle: /assets/index-vgoyRCWh.js (Home chunk /assets/Home-g1XMclj0.js)
- live sw.js: const CACHE_VERSION = 'sokomw-v37'

git log --oneline -3:
b5582f4 Merge wip/lf-cards-v2
329c287 WIP: rebuild artifacts
1bd4453 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
