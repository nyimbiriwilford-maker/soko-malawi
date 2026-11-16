Phase C: Home Looking For ranking + Near You filter - verified locally.

Build: npm run build -> ✓ built in 2.30s
Preview: npm run preview -> http://localhost:4173/ HTTP 200, stderr empty, no console errors observed
Git: master ahead of origin/master by 2 commits (push blocked: Could not resolve host github.com)
  66e0cd9 WIP: rebuild artifacts
  d91e254 WIP: Phase C ranking and Near You filter verification
  59be9af Fix Home Looking For TDZ crash
Status: ## master...origin/master [ahead 2]

Production (unchanged, push not applied):
  curl https://sokomw.com/ -> index-DqkvYqzH.js
  curl https://sokomw.com/sw.js -> sokomw-v33

LF_WEIGHTS:
  const LF_WEIGHTS = { verified: 15, location: 35, recency: 30, exposure: 20, urgencyNonFlexible: 10, urgencyMedium: 5 }
  const LF_NEAR_KM = 25
  urgency values found: urgent, this_week, flexible (no medium -> +10 for non-flexible)

Filter code (ranked useMemo):
  if (lfNearby === 'near') { city match OR haversine <= LF_NEAR_KM }
  else if (lfNearby !== 'all') { reqCities includes target district }
  filtering occurs before scoring/sorting; lfSort still applied after.

Vercel: not checked (no credentials). Push pending network availability.
