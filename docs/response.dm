Done ✅ I refined the Home Categories section to keep a **vertical card layout**, use cleaner premium icon treatment, and fit better in that area on mobile and desktop.

## What I changed

### 1) Keep categories in vertical card format
File: `src/pages/Home.jsx`
- Ensured category tiles remain vertical (icon above label) for a professional catalog look.
- Added explicit mobile rule to keep card content vertical:
  - `display: flex`
  - `flex-direction: column`

### 2) Premium/professional icon style
File: `src/pages/Home.jsx`
- Kept clean line icons and improved the visual treatment:
  - polished icon badge container (`.soko-cat-icon-wrap`) with subtle inset + elevation
  - better color balancing for trust/professional tone
- Improved category text/subtext wording to feel higher quality and clearer.

### 3) Better fit in the Home placement
File: `src/pages/Home.jsx`
- Reduced section top spacing so it sits better under the hero.
- Changed desktop grid from `9` narrow columns to a more readable and premium layout:
  - default: **5 columns**
  - ≤1200px: **4 columns**
- Mobile tuning for fit and clarity:
  - ≤980px: **4 columns**
  - ≤640px: **3 columns**
  - ≤420px: tighter spacing/padding
  - Landscape phones: **6 columns**

This keeps categories visible and balanced on horizontal phone screens by default, without a cramped or low-trust look.

## Validation
- Ran: `npm run build`
- Result: ✅ successful build.
