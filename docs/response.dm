Done. Merged wip/lf-plus-icon to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: phone "+" button is now transparent 44x44 tap area with 28px green Plus icon (stroke 2.5), active opacity 0.6. Tablet/laptop unchanged.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-DQFjpv97.js
- live sw.js: const CACHE_VERSION = 'sokomw-v42'

git log --oneline -3:
16a5b67 WIP: update response.dm
ff43435 Merge wip/lf-plus-icon
01500e5 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
