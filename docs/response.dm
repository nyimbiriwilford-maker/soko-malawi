Done. Merged wip/lf-home-actions to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: Home "Make offer" reuses shared makeOffer helper (login prompt for logged-out, hidden on own request, stopPropagation). Card tap opens details with role="link", tabIndex 0, Enter support, cursor pointer, :active bg #f8f9fa. No list-page navigation from card wrapper.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-CM33MnBV.js
- live sw.js: const CACHE_VERSION = 'sokomw-v43'

git log --oneline -3:
e24762f WIP: update response.dm
3b265e4 Merge wip/lf-home-actions
7c4dc23 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
