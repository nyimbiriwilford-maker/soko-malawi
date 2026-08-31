TASK: On the same home page. Don't change anything — just change the arrangement. Statuses should come just after the top banner section, followed by the shop categories section.

WHAT WAS DONE:
- Reordered the sections in the Home page's render tree (src/pages/Home.jsx, Home component JSX) — pure arrangement change, no content/style changes.
- The Statuses section (HomeStatusSection) was moved from below the FeaturedRevenueBanner up to sit immediately after the top/hero banner (HeroBanner).
- The Shop by Category section (CategoryGrid) now comes immediately after the Statuses section (unchanged CSS/layout).
- Only transition comments were updated for accuracy (— Statuses → Categories transition, — Featured → Marketplace transition). No rendered text or styles were altered.

NEW SECTION ORDER:
1. Header (SokoNav)
2. Top/hero banner (HeroBanner)
3. Statuses (HomeStatusSection)
4. Shop by Category (CategoryGrid)
5. Featured revenue banner (FeaturedRevenueBanner)
6. Featured listings (FeaturedListingsRow)
7. Latest listings (LatestListingsSection)
8. Looking For (LookingForSection)
9. Shops / Jobs / Services row (ShopsJobsServicesRow)
10. Sell CTA (SellCtaBanner)
11. Footer (SokoFooter)

VERIFIED:
- npx eslint src/pages/Home.jsx — only the same pre-existing errors from before (unused imports at line 27, react-hooks warnings); none at the reordered block.
- npm run build — success (fresh dist output produced).
- git diff confirms only src/pages/Home.jsx is changed and it is a pure reorder (14 insertions / 14 deletions — the statuses block net zero moved up). dist/index.html build artifact was reverted.


