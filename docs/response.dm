Services phase 6B complete.

Report (before edits):
- Services fetched all at once (loadServices, no paging). Card component: ServiceCard in ServicesPage.jsx. Images: service.media_urls (Supabase storage URLs); no resize/thumbnail mechanism exists. Keep original URLs.
- Thumbnail mechanism: none.

Implementation:
- Page sizes: phone 10, tablet 12, laptop 16 via pageSize state + resize listener.
- Phone: IntersectionObserver sentinel (rootMargin 400px) appends next batch. Tablet/laptop: "Load more services" button (44px, green outline, 12px radius).
- Reset to first page on search/category/city/verified/sort changes; not on resize.
- Result count text uses total filtered count.
- Card detail by breakpoint: phone image/title/price/city/Book+Chat; tablet adds provider name+verified tick; laptop adds one-line description (13px #5f6368 ellipsis) and rating (star+value) only if rating exists. Equal height via stretch.
- Images: width/height 400x300, loading lazy/eager for first 4, decoding async, fetchpriority high for first image only. saveData: no resize mechanism, original URLs retained.

Build: OK. Lint: OK (pre-existing warning only).
git log --oneline -3:
cd2f7fd Services phase 6B: paging and card detail by breakpoint
8256372 Services phase 6A: ranking and Recommended sort
ae10a80 Services phase 5: featured rail and visibility
Vercel: deployed — sw.js sokomw-v23, index-BdpOYa_T.js.