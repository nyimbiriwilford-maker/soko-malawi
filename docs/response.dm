# Mobile header — search as icon (expands on tap), aligned with bell

## Request
In `src/components/SokoNav.jsx`, MOBILE view only: present the search as an icon button aligned next to the notification bell, well-aligned and modern. Tapping the search icon opens the search box. Desktop unchanged.

## Changes (applied)
1. **Row 1** now holds Logo (left) + two identical 38px circular buttons (right): Search icon + Notification bell — perfectly aligned (gap 8).
   - Search button: green-tinted idle (`#f4f8f5` bg, `#e2ebe4` border, green icon); inverts to solid green with white icon when the search is open. Transition on background/color/border.
   - Bell button unchanged (green icon + red count badge).
2. **Row 2 (expandable search)**: hidden by default. Tapping the search icon:
   - Slides the full-width pill search bar in (`animation: sokoSearchIn 0.22s cubic-bezier(.16,1,.3,1)`), auto-focuses the input.
   - Active focus state keeps the green border + soft glow ring.
   - Right side has a circular solid-green **close** button (X) that collapses the bar, clears the query, and unfocuses.
   - Typing still routes to `/search?q=...` with `focus=1` exactly as before.
3. **Desktop untouched**: desktop search bar + district filter still present.

## Verification
- `npm run build`: PASSES — 2107 modules, built in 2.09s, no errors.
