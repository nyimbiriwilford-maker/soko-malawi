Done. Merged wip/lf-toolbar-polish to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: toolbar one row gap 8px no wrap/overflow; removed View all button; phone pills 44px flex, round 44x44 + button; tablet+ natural pills + Post Request button. Buyer name sentence case 12px weight 600 #5f6368 max-width 96px ellipsis.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-j8dEpOhr.js
- live sw.js: const CACHE_VERSION = 'sokomw-v40'

git log --oneline -3:
f27e4ee WIP: update response.dm
0c77f37 Merge wip/lf-toolbar-polish
342964d WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
