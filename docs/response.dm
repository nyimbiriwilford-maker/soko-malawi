# Mobile header quick actions — icons only, Verification removed

## Request
On the mobile header, the quick action row (Market, Status, etc.) should be presented as icons only (no text labels). Remove the "Verification" item.

## Status: implemented in `src/components/SokoNav.jsx`
Mobile-only change; desktop pillar row untouched.

- **Icons only:** The mobile quick-actions row (`.soko-quick-scroll`, mobile header Row 2) now renders each pillar as a 42x42 icon-only button (`aria-label` keeps the accessible name) — no text label shown.
- **Verification removed:** The row filters out `p.key === 'verify'`, so Verification no longer appears on mobile. It remains in the desktop pillar row.
- Each icon still navigates to its path (Marketplace `/`, Shops `/shops`, Looking For `/looking-for`, Jobs `/jobs`, Services `/services`, Statuses `/status`).

## Verification
- `npm run build`: PASSES — built in 2.08s, no errors.
- Desktop layout untouched.

## Files changed
- `src/components/SokoNav.jsx`
