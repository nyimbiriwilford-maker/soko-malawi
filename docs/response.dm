# Mobile header — plain icons, no search box below (mobile view only)

## Request (from docs/claudehelp.dm)
1. Mobile header (mobile view only): remove the circular box styling around the search and notification icons — present both as plain professional icons on the same row (no boxes/borders).
2. Mobile header (mobile view only): remove the search box below (Row 2) entirely — keep the plain search + notification icons on the same row; the search icon navigates to /search.

## Status: implemented in `src/components/SokoNav.jsx`
The previous `docs/response.dm` incorrectly claimed this was already done. It was not — the boxed search/bell icons and the Row 2 search hero were still present. Fixed now, mobile-only.

- **Phase 1 (plain icons):** The mobile search icon and notification bell (SokoNav.jsx mobile header Row 1) now render as plain inline SVG icons with `background: none; border: none; padding: 0` and a `#334155` (slate) color — no boxes, borders, or rounded backgrounds. The 40px tap target is kept so touch targets stay accessible.
- **Phase 2 (search box removed):** The Row 2 "Search anything..." hero button was deleted entirely. The mobile header now holds only Logo (left) + search icon + notification bell + profile (right) on one row. Search icon navigates to `/search?focus=1`; bell navigates to `/notifications`.
- Dead `.soko-search-hero` CSS rules were removed from the `@media (max-width: 768px)` and `@media (max-width: 360px)` blocks.

## Verification
- `npm run build`: PASSES — built in 2.49s, no errors.
- Only the mobile section (`.soko-nav-mobile`) was changed; the desktop header and desktop pillar row are untouched.

## Files changed
- `src/components/SokoNav.jsx`
