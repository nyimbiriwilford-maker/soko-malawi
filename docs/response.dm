TASK: Go on the home page and compact the categories into one horizontal row for desktop view. Do not touch mobile view. Do not change anything else.

WHAT WAS DONE:
- The "Shop by Category" grid (CategoryGrid -> .soko-cat-grid) in src/pages/Home.jsx previously laid out its 9 tiles (8 quick categories + "More") across multiple rows on desktop (5 columns -> 2 rows, or 4 columns -> 3 rows under 1200px).
- Added a single CSS block in the GlobalStyles <style> in src/pages/Home.jsx:

  @media (min-width: 769px) {
    .soko-cat-grid { grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 10px; }
    .soko-cat-grid .soko-cat-tile { compact padding, no min-height floor, smaller gap }
    .soko-cat-grid .soko-cat-icon-wrap { 32px icons }
    .soko-cat-grid .soko-cat-sub { display: none }
    .soko-cat-grid .soko-cat-label { 11px, nowrap, ellipsis }
  }

  This makes all 9 category tiles fit in ONE horizontal row on desktop, in a compact/slim layout.

GUARANTEES:
- Desktop only: the rule is inside @media (min-width: 769px) (the app's desktop breakpoint — same one SokoNav/BottomNav use).
- Mobile untouched: all existing @media (max-width: 768px) (and smaller) styles are unchanged; the horizontal-scroll mobile category row still behaves exactly as before.
- Nothing else changed: only this additive CSS was inserted (26 lines added, no lines removed/modified elsewhere). HomeHeader.jsx was checked and is unused dead code — the only live category section is .soko-cat-grid.

VERIFIED:
- npx eslint src/pages/Home.jsx — only pre-existing errors (unused imports at line 27, react-hooks warnings, etc.); no errors at the inserted lines.
- npm run build — success ("built in 3.25s").
- git diff confirms the sole source change is src/pages/Home.jsx (the temporary dist/index.html build-artifact change was reverted).


