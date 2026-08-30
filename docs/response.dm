TASK: On the shop page, the section with the search box and filters takes a lot of space and hides the listings while scrolling — listings get a small visible area. Move the search and other functions to an appropriate place so listings keep proper visibility.

ROOT CAUSE:
- On mobile the whole tab bar (.sp-tabs) is sticky under the top nav. It contained BOTH the tab pills (Listings / About / Reviews / Policies) AND the search box + two dropdown filters + view toggle (.sp-tabs-right). That pinned block was ~160px tall on phones, permanently covering nearly a third of the screen while scrolling products.

DONE in src/pages/ShopPage.jsx:

1. Sticky tab bar slimmed down
   - The sticky bar now contains only the four tab pills. It keeps its slim single-row height (~48px), so scrolling listings now get the space the old filter block was stealing.

2. Search + filters moved into the listings column (new .sp-listings-toolbar)
   - The search box, Category filter, Sort select and Grid/List view toggle moved out of the tab bar into a compact in-flow toolbar that sits directly above the products inside the listings column.
   - It scrolls away with the page like the products do (no longer pinned), so nothing overlays the listings while scrolling.
   - It appears only when the Listings tab is active (same condition as before) and shows above the skeleton, the empty state (so "Clear filters" is right there) and the product grid alike.

3. Layout
   - Desktop: single row — search flexes to fill (min 220px), selects keep natural width, view toggle at the end; wraps gracefully on narrower widths.
   - Mobile (≤900px): search takes the full row on its own line (42px tall, 16px font for no iOS zoom), the two selects share the next row, view toggle aligned right — same touch sizes as before.

4. Cleanup
   - Removed the now-dead .sp-tabs-right styles and the obsolete min-width:901px display override for the search box (it no longer hides on desktop).

VERIFIED:
- npx eslint src/pages/ShopPage.jsx — same 8 pre-existing problems as on HEAD (0 new issues).
- npm run build — built successfully.
