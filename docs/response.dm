Done. Merged wip/lf-home-simplify to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: removed toolbar row from Home Looking For section; list stays newest-first no filter; heading row flex (title ellipsis, phone only + button, tablet+ See all + Post Request); gap 16px.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-Czx8-MWK.js
- live sw.js: const CACHE_VERSION = 'sokomw-v41'

git log --oneline -3:
4261e0a WIP: update response.dm
b2b86a2 Merge wip/lf-home-simplify
8631b5a WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
