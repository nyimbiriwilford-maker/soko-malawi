TASK: On the same place (statuses → categories) add a proper transition and distance from where the status section ends to where the categories section starts.

WHAT WAS DONE:
- Rebuilt the statuses → categories bridge in src/pages/Home.jsx (Home render tree) as a proper transition zone:
  - Height increased 40px → 52px on desktop for real breathing room between sections.
  - Smooth 3-stop background blend (#f8f9fa → #FAFBFC → #FFFFFF) so the statuses gray eases into the categories white instead of a hard color jump.
  - Refined divider: two fading gradient rails (transparent → gray → transparent) joined by a small green Soko accent dot (#0F9D58 at 50% opacity), max-width 300px, centered.
- Added a mobile override (.status-cat-bridge at max-width 980px → 34px) next to the existing .bc-bridge / .ll-lf-bridge rules so phones get proportionate spacing.

VERIFIED:
- npx eslint src/pages/Home.jsx — no new errors at the edited lines (same pre-existing warnings only).
- npm run build — success.
- Other section bridges and all other sections untouched.


