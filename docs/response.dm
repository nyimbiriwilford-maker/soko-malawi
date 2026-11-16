Done. Merged wip/home-shops-fix to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: shop card CSS moved out of mobile media query so desktop grid/images apply; media block overflow visible with cover overflow hidden; logo overlaps correctly.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-n6Rwafem.js
- live sw.js: const CACHE_VERSION = 'sokomw-v47'

git log --oneline -3:
ed84192 WIP: update response.dm
1cc2343 Merge wip/home-shops-fix
f44069f WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
