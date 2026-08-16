Done ✅

I made a focused mobile-only change so **only 3 categories are visible by default** on screen, and the rest appear when scrolling horizontally.

## Change made
- File: `src/pages/Home.jsx`
- In mobile categories CSS (`@media (max-width: 768px)`), category tile width is now dynamic:

```css
width: calc((100vw - 44px) / 3)
min-width: calc((100vw - 44px) / 3)
max-width: calc((100vw - 44px) / 3)
```

This ensures proper fit for 3 cards across the phone width (with existing side padding and gap), while preserving horizontal scroll for the remaining categories.

## Validation
- Ran: `npm run build`
- Result: ✅ successful build
