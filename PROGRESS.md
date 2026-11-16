1. Inspect state - Home.jsx Phase C items present (LF_WEIGHTS, urgency bonus, LF_NEAR_KM, lfNearby filters, useEffect near, options check icon, Show all Malawi); build passed
2. Continue/verify - npm run build passed; preview started (HTTP 200); no TDZ errors found in code review3. Step 1 - Card redesign LookingForRequestCard.jsx + CSS (phone horizontal, tablet/laptop vertical, removed caption/buyer/avatar/desc/view details/icons, budget format, hover lift 1100px+)
4. Step 2 - Grid/counts (.lfr-grid gaps/padding, initial counts 4/6/8 via window-width hook, See all requests button, buyer_requests limit 40->16)
5. Step 3 - Section heading People Looking For 20px/22px weight 800 with See all green link 44px tap target
6. Step 1 v3 - Home now renders LookingForRequestCard (shared redesigned card); removed old inline lfr-card markup/CSS
7. Step 2 v3 - grid/counts already in place (4/6/8, See all requests, limit 16)
8. Step 3 v3 - heading People Looking For already in place
9. Step 1 laptop-fix - card footer column at 768px+ (gap 10px, buyer row space-between, full-width button box-sizing border-box, no margin)
10. Step 2 laptop-fix - grid aligns with heading/toolbar (section padding 14px/24px, grid no side padding)
11. Step 1 toolbar-polish - removed View all button, lf-toolbar gap 8px no wrap/overflow, pills 44px flex on phone, round + button; natural width + Post Request on tablet+
12. Step 2 toolbar-polish - buyer name sentence case 12px weight 600 #5f6368 max-width 96px ellipsis
13. Step 1 home-simplify - removed toolbar row (location/sort), kept newest-first no filter, disabled auto-near effect
14. Step 2 home-simplify - heading row flex with title ellipsis, phone only + button, tablet+ See all + Post Request, gap 16px
15. Step 1 plus-icon - phone + button transparent 44x44, Plus 28px stroke 2.5 green, active opacity 0.6; tablet+ unchanged green button
16. Step 1 home-actions - Make offer reuses shared makeOffer helper (login prompt, own request hidden); button stopPropagation
17. Step 2 home-actions - card tap opens details with role link/tabIndex/Enter/cursor/:active bg; no double nav
