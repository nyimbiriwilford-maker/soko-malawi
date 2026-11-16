Done. Merged wip/lf-laptop-fix to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: card footer is a column at 768px+ (gap 10px, buyer row space-between, full-width button box-sizing border-box, no margin/sliver). Grid aligns with heading/toolbar (section padding 14px phone / 24px laptop, grid no side padding).

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-DNUlaghF.js (Home chunk /assets/Home-BMpr8eQl.js)
- live sw.js: const CACHE_VERSION = 'sokomw-v39'

git log --oneline -3:
bf30449 WIP: update response.dm
dbf511f Merge wip/lf-laptop-fix
bead328 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
