Done ✅ I fixed both issues on the Home page sections (Jobs + Looking For).

## What was fixed

### 1) Filter options were getting hidden when clicked
Cause: both filter rows were configured as horizontal scroll containers (`overflowX: auto`), which can clip absolutely-positioned dropdown menus.

Fix applied in `src/pages/Home.jsx`:
- **Looking For filter row**
  - changed from horizontal scroll container to wrapping visible container
  - from:
    - `flexWrap: 'nowrap'`
    - `overflowX: 'auto'`
    - scrollbar-hiding props
  - to:
    - `flexWrap: 'wrap'`
    - `overflow: 'visible'`

- **Jobs filter row**
  - same change as above
  - now dropdown menus open fully and are not clipped/hidden

### 2) Removed the “scroll helper/filter scroll bar” behavior
You asked to remove the filter bar that helps scrolling.

Fix applied:
- removed horizontal scrolling behavior from both filter rows by removing the overflow-x scroll setup
- filters now lay out in normal wrapped rows instead of a horizontal scroller

### 3) Small alignment adjustment after removing spacer
In Looking For filter row:
- removed the manual spacer div (`<div style={{ flex:1 }} />`)
- kept actions aligned by using `marginLeft: 'auto'` on the action group

## Validation
- Ran: `npm run build`
- Result: ✅ successful build.

If you want, I can also make the filter dropdowns open **upward** on very small screens when there isn’t enough space below.