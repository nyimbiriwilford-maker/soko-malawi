STEP 1 contributors at 390px (Home.jsx embedded CSS):
- .soko-cat-grid (category rail) padding-bottom: 16px (max-width:768px rule, padding: 8px 14px 16px)
- .soko-cat-section padding-bottom: 8px (max-width:980px rule, padding: 0 0 8px)
- .soko-cat-section margin-bottom: 0 (no rule)
- .bc-bridge spacer between sections: height 28px (max-width:980px override of inline 32px)
- section[aria-label="Get featured pricing"] padding-top: 8px effective (12px max-width:980px overridden by 8px max-width:768px)
- .soko-featured-banner margin-top: 0
- .soko-featured-banner internal padding-top: 10px (does not affect outer gap)

STEP 2/3 changes in src/pages/Home.jsx:
- Removed the bc-bridge spacer between CategoryGrid and FeaturedRevenueBanner.
- Category section padding-bottom -> 0, margin-bottom -> 0 (inline + media rules).
- Banner container padding-top -> 0; side padding 14px phone / 24px laptop.
- Banner margin-top set as only gap control: 8px phone, 16px tablet, 24px laptop.
- Category rail padding-bottom left at 16px.

Build: npm run build passed.

Diff: Home.jsx only (see git diff).

Verification: 360/390/768/1440 -> 24/24/32/40px; banner edges align 14/14/24/24; no spacer/band remains; card shadows preserved by 16px rail padding.
EOF