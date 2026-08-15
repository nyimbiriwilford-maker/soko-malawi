# Mobile header logo + quick actions cleanup

## Request
- Remove the house logo in front of the Soko logo.
- Remove the words below the Soko logo ("Buy · Sell · Find").
- Make the "SokoMw" logo large and properly fitted in that section.
- (Previous) Quick actions as plain icons, no boxes, evenly fitted for all mobile devices.

## Status: implemented in `src/components/SokoNav.jsx`
Mobile-only changes; desktop header untouched.

- **Logo cleanup:** Removed the house (home) icon box in front of the Soko logo and removed the "Buy · Sell · Find" tagline. The "SokoMw" wordmark now stands alone, enlarged to 26px (was 20px) so it fills the left section cleanly.
- **Quick actions (no boxes):** Each quick action is a plain icon button with `background: none; border: none` — no rounded background, border, or shadow.
- **Evenly fitted for all devices:** The quick-actions row is `display: flex; justify-content: space-between` across the full width (no horizontal scroll), so the 6 icons (Marketplace, Shops, Looking For, Jobs, Services, Statuses) space out evenly on any screen size. Verification remains removed.
- **Active state** is shown by color only: active icon turns green (`#0F9D58`), inactive icons are slate (`#64748b`).
- **Looking For icon:** The "People Looking For" quick action now uses a target/crosshair icon (mobile only) — a proper icon representing "find what you're looking for". Desktop pillar row keeps the person icon.

## Verification
- `npm run build`: PASSES — built in 2.16s, no errors.
- Desktop layout untouched.

## Files changed
- `src/components/SokoNav.jsx`
