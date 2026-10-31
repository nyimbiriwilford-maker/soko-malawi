getBannerCta: src/utils/homeUtils.js:416.
Home price: subtitle line src/pages/Home.jsx:4799-4802 (slide.desc) and separate price chip src/pages/Home.jsx:4996-5002 (above button).
Form subtitle prefill: src/pages/Admin.jsx:2812 (useEffect) and :3160 (picker click) and :3087 (Enter handler).

Changes:
- getBannerCta linked listing label now "View product"; service/job/shop/request labels preserved; custom cta_label wins.
- Admin no longer prefills subtitle with price; prefills title + category.
- Home strips price text from desc at render; single price chip above button using formatPrice, reserved space.
- Old "Shop now" auto button_text ignored on Home.

Build passed (npm run build). Commit: (see hash)