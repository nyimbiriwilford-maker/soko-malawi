Done ✅ I upgraded the Home **Categories** section to look more professional, trustworthy, and mobile-friendly.

## What I changed

### 1) Better, more premium category icon presentation
File: `src/pages/Home.jsx`

- Refined category icon palette and visual hierarchy (cleaner professional colors).
- Upgraded icon container style from simple circles to premium rounded-square icon badges.
- Added subtle inset/shadow polish on icon containers for a smart, high-quality look.
- Upgraded header copy to feel more trusted and marketplace-focused:
  - **Shop by Category**
  - **Trusted categories for faster discovery**
- Improved “More” tile with proper icon badge (`layers`) so it matches the category cards style.

### 2) Mobile fit improvement (no forced tiny scroll-first layout)
File: `src/pages/Home.jsx`

Previously categories were forced into a tiny horizontal scroller on mobile/tablet.
That made cards feel cramped and required scrolling immediately.

I replaced that behavior with a responsive premium grid:
- ≤980px: **4 columns**
- ≤640px: **3 columns**
- ≤980px in landscape: **6 columns**

This means categories now fit the horizontal phone screen much better by default before any extra scrolling.

### 3) Card sizing and typography tuned for mobile readability
File: `src/pages/Home.jsx`

- Reduced mobile card/icon dimensions for clean fit.
- Kept labels readable with proper truncation and centered alignment.
- Hidden micro-subtext on small screens to avoid clutter and maintain a premium appearance.

## Validation
- Ran: `npm run build`
- Result: ✅ successful production build.

If you want, I can also do a second polish pass to match icon style/colors with your brand system exactly (e.g., stricter green/amber identity), while keeping this layout behavior.