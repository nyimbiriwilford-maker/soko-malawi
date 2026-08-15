# Mobile header quick actions — plain icons, evenly fitted, no boxes

## Request
The mobile quick action icons (Market, Status, etc.) must NOT be placed in circular/rounded boxes. Present them as clean, smart, plain icons that are properly fitted for all mobile devices.

## Status: implemented in `src/components/SokoNav.jsx`
Mobile-only change; desktop pillar row untouched.

- **No boxes:** Each quick action is now a plain icon button with `background: none; border: none` — no rounded background, border, or shadow.
- **Evenly fitted for all devices:** The row is `display: flex; justify-content: space-between` across the full width (no horizontal scroll), so the 6 icons (Marketplace, Shops, Looking For, Jobs, Services, Statuses) space out evenly on any screen size. Verification remains removed.
- **Active state** is shown by color only: active icon turns green (`#0F9D58`), inactive icons are slate (`#64748b`).

## Verification
- `npm run build`: PASSES — built in 2.16s, no errors.
- Desktop layout untouched.

## Files changed
- `src/components/SokoNav.jsx`
