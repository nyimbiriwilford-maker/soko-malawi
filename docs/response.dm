TASK: On the home page, Services and Jobs are presented in mobile view like on the website (horizontal card rails). Fix this — in mobile the view should be like in a mobile app: vertical list (ul) presentation.

DONE in src/pages/Home.jsx — ShopsJobsServicesRow section (Jobs + Services blocks):

1. Mobile app-style vertical list (CSS-only, ≤768px breakpoint)
   - `.soko-sjs-rail` — the horizontal scroll rail used for Jobs and Services — becomes a vertical stacked list on mobile: `flex-direction: column`, no horizontal scrolling, no scroll-snap, full-width items, 10px vertical gaps. Desktop/tablet (>768px) keeps the existing horizontal rail presentation untouched.
   - Loading skeletons in these rails become full-width list-row placeholders on mobile (height 88px).

2. Jobs — mobile list item style (`.soko-work-card`)
   - Full-width compact row card: 88px media thumbnail on the left, text body on the right — the classic mobile-app job list row.
   - Tighter app-like typography: 1-line title clamp, smaller company/type/salary/location text, slimmer Apply button.

3. Services — mobile list item style (`.soko-service-card`)
   - The desktop vertical card (image on top) becomes a horizontal row card on mobile: 88px square thumbnail on the left with the category chip overlaid at its top-left, name/location/rate on the right, and the "Book Now" pill as an inline compact chip instead of a full-width bar.

4. Job filter chips row
   - Changed `overflow: visible` to horizontal scroll (`overflow-x: auto`) so the three filter dropdowns (Category / Type / Sort) can't overflow the screen edge on narrow phones; dropdown popouts still open since overflow-y remains visible.

No JSX structure or data flow changed — same cards, same click handlers, same filters; only the mobile presentation via the section's media query. Website (desktop) view is unchanged.

VERIFIED:
- npx eslint src/pages/Home.jsx — same 68 pre-existing problems as on HEAD (0 new issues introduced).
- npm run build — built successfully.
