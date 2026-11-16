Done. Merged wip/lf-home-offer-fix to master and pushed.

Build: passed. Preview: http://localhost:4173/ returned 200. Console: no errors observed.

Fix: shared makeOffer now uses optional onOfferStarted callback instead of setRequests; Home passes its own list updater via onOffer prop; Looking For page behaviour unchanged. No ReferenceError.

Verification:
- Vercel: live at https://sokomw.com/
- live bundle: /assets/index-B5HEKJgT.js
- live sw.js: const CACHE_VERSION = 'sokomw-v44'

git log --oneline -3:
301c77c WIP: update response.dm
04d9c35 Merge wip/lf-home-offer-fix
74e04b3 WIP: bump sw cache version

git status -sb: ## master...origin/master (clean)
