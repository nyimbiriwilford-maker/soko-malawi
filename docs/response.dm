
# Mobile header redesign — applied

## Request
Replace the mobile header in `src/components/SokoNav.jsx` (rows: logo, district selector, search bar, notification bell) with a polished version covering phones, large phones, and tablets in portrait. Update both the JSX block and the `.soko-nav-mobile` CSS in the component's `<style>` tag.

## Changes (applied)
1. **JSX block** (`src/components/SokoNav.jsx`, MOBILE HEADER section):
   - Row 1 logo: bigger/tighter lockup — fontSize 22, weight 900, tagline `Buy · Sell · Find · Anywhere in Malawi` at 9px gray500.
   - District pill: green-tinted when a district is active, 1.5px border, shadow, weight 700; chevron rotates 180° when sheet open (transform transition).
   - District bottom sheet: blurred overlay (`backdrop-filter: blur(2px)`), drag-handle bar, 17px/800 header, larger radius (24), safe-area bottom padding, white unselected grid tiles with 1.5px borders, `No district found` centered.
   - Notification bell: 38px circle, 1.5px border + shadow to match pill, badge at top:0/right:0 with 2px white ring and lineHeight 1.
   - Search bar: 44px min-height (Apple/Google tap target), green border + `T.greenL` glow ring when focused, white bg when focused, elevated shadow, placeholder `Search anything in Malawi...`, 14px text.
2. **CSS block** (`.soko-nav-mobile` in the `<style>` tag):
   - `@media (max-width: 768px)`: padding now `10px max(14px, env(safe-area-inset-left)) 10px max(14px, env(safe-area-inset-right))` for notched/Dynamic Island phones; gap 10px; `border-bottom: 1px solid #f0f0f0`.
   - `@media (min-width: 769px)`: mobile header hidden (unchanged).
   - Kept unrelated `.soko-scroll` rules intact.

## Token / dependency notes
- Uses existing tokens only: `T.fontDisplay`, `T.green`, `T.greenL`, `T.amber`, `T.red`, `T.gray50/100/200/400/500/600/700/800/900` (all confirmed present in `src/constants/tokens.js`, incl. `gray700`).
- Uses existing `Icon.*` and `createPortal`; no new deps.

## Verification
- `npm run build`: PASSES — 2107 modules, built in 3.43s, no errors. `SokoNav-CoJzr6Da.js` emitted (24.12 kB).
