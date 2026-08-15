# Mobile header — plain professional icons (no circular boxes)

## Request
Remove the circular box styling around the search and notification icons in the mobile header. Present both icons professionally on the same row.

## Changes (applied) — `src/components/SokoNav.jsx`, MOBILE HEADER section
- **Search button**: removed the 38px circle / background / border. Now a plain icon-only button (no padding, no box), colored slate (`#334155`), turning green when the search is open.
- **Notification bell**: same — plain icon-only button, no box. Count badge sits at `top:-3 / right:-5` with a 2px white ring.
- Both icons are 20px and aligned on the same row with a clean `gap: 14` between them.

## Verification
- `npm run build`: PASSES — 2107 modules, built in 1.99s, no errors.
