TASK: Hide the "Create Status" card on home page statuses section on landing/refresh so only posted status cards are visible; reveal it on scroll, or keep it visible when 0-1 posters (mobile fills its two visible card slots).

DONE in src/components/HomeStatusSection.jsx:

1. Flicker-free hide on landing/refresh
   - Removed the old setTimeout(100ms) auto-scroll effect (which visibly flashed the create card before jumping).
   - Added a useLayoutEffect (runs before paint) that measures the create card's real width + rail gap from the DOM and sets the rail's scrollLeft past it. So on landing/refresh the user sees posted status cards only — no flash of the create card.

2. Visibility rules (cards are grouped per person, so counts are per poster):
   - 2+ posters: create card is off-screen at position 0. Scroll/swipe left to reveal it. New statuses arriving while scrolled do NOT yank scroll position back.
   - Exactly 1 poster: rail starts at position 0 showing Create Status card first, the posted status second — fills mobile's two visible card slots.
   - 0 posters: the create card is shown in the rail (previously a text-only empty state was shown instead). The "No X stories right now" empty message is kept only for non-All category filters.

3. Header: "View All" button is now hidden when there are no statuses (it was a no-op before).

VERIFIED:
- npx eslint src/components/HomeStatusSection.jsx — clean (0 errors, 0 warnings).
- npm run build — built successfully (4.43s).
