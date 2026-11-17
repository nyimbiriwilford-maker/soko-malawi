Branch: wip/services-filter-sheet -> merged to master and pushed.

TASK: On the Services page (mobile), the Filters and Sort bottom sheets were being hidden by the fixed bottom nav / clipped on short phones. Make the sheets render above the header and bottom nav and keep the whole sheet visible.

REPORT (pre-change, file + line)
1. Both sheets rendered inline inside the Services page tree, so position:fixed could be trapped by an ancestor stacking context: filter sheet src/pages/ServicesPage.jsx:1325, sort sheet :1411.
2. Backdrop .svc-sheet-backdrop was z-index 1200, but the sheet panels .svc-filter-sheet/.svc-sort-sheet were z-index 301 (src/pages/ServicesPage.jsx:309-316) - below their own backdrop and below the fixed bottom nav (z-index 1000, src/components/BottomNav.jsx:262) and sticky header (z-index 100, src/components/SokoNav.jsx:238).
3. Sheet height was max-height 85vh only (no dvh fallback) and the panel itself carried the safe-area padding.

STEP 1
Imported createPortal from react-dom and rendered both filter and sort sheets through createPortal(..., document.body), so fixed positioning is relative to the viewport, not the page container.

STEP 2
Overlay .svc-sheet-backdrop is fixed inset 0, rgba(0,0,0,.45), z-index 1200 - above the header (100) and bottom nav (1000); no nav z-index values were touched.

STEP 3
Sheet panels are z-index 1201 (above their own backdrop), border-radius 20px, max-height 85vh with 85dvh fallback, overflow hidden. Removed panel-level safe-area padding; the footer keeps calc(12px + env(safe-area-inset-bottom)), so Apply/Clear stay above the home indicator and the whole sheet fits a short phone. Existing body scroll lock (ServicesPage.jsx:754-760) and focus trap (:732-752) are unchanged.

RAW
npx eslint src/pages/ServicesPage.jsx | Select-String "no-undef"
(no output)

npm run build
dist/assets/ServicesPage-C6UX7hFG.js   61.63 kB | gzip: 14.96 kB
dist/assets/index-Co7KG0YG.js         228.12 kB | gzip: 65.86 kB
built in 2.81s

git log --oneline -4
(see below after merge)

sw cache: live was sokomw-v53, bumped to sokomw-v54 (public/sw.js; dist/sw.js verified v54)
local built bundle: index-Co7KG0YG.js (ServicesPage-C6UX7hFG.js)

Not touched: no SQL, no change to filter/sort state logic, no change to the desktop services layout.
