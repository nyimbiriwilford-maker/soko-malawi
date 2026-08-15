# Mobile header — district picker removed, cleaned up (mobile view only)

## Request
In `src/components/SokoNav.jsx`, remove the option to choose districts from the MOBILE view only and make the mobile header professional, smart and clean. Desktop must be unchanged.

## Changes (applied)
1. **District picker removed from mobile** (`src/components/SokoNav.jsx`, MOBILE HEADER section):
   - Removed the mobile "District Filter Button" (pin + district label + chevron).
   - Removed the mobile "Select District" bottom sheet entirely (overlay, handle bar, search input, 2-col district grid).
   - Row 1 is now just Logo + Notification Bell.
   - Cleaned up now-unused mobile-only state: removed `districtSearch` state, `filteredDistricts`, and `createPortal` import; `changeDistrict()` no longer resets `districtSearch`.
2. **Desktop untouched**: desktop district filter (pin pill + dropdown) still present.
3. **Mobile header polish**:
   - Logo: 21px/900 green `Soko` + amber `Mw`, tagline `Buy · Sell · Find · Anywhere in Malawi`.
   - Notification bell: 38px circle, green-tinted `#f4f8f5` bg, `#e2ebe4` 1px border, green icon; badge at top-right with 2px white ring.
   - Search bar: 44px min-height pill (`border-radius: 50`), green border + soft glow ring when focused, `#f4f8f5` idle bg, placeholder `Search anything in Malawi...`.

## Verification
- `npm run build`: PASSES — 2107 modules, built in 2.64s, no errors. `SokoNav-D1xGhqwd.js` emitted (20.24 kB).
