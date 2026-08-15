# Mobile header — search box below removed (mobile view only)

## Request
Remove the search box that sits below the logo row in the mobile header. Keep the plain professional search + notification icons on the same row.

## Changes (applied) — `src/components/SokoNav.jsx`, MOBILE HEADER section
- Removed the entire Row 2 "Expanding Search Bar" block (input, placeholder, clear + close buttons).
- Search icon now navigates straight to `/search?focus=1` on tap instead of expanding an inline box.
- Removed now-unused `mobileSearchOpen` state and the `sokoSearchIn` keyframe animation.
- Row 1 now holds only: Logo (left) + plain Search icon + Notification bell (right), all on the same row.

## Verification
- `npm run build`: PASSES — 2107 modules, built in 2.54s, no errors.
