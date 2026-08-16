Done ✅

I changed only what you asked:

- On **mobile**, Home categories are now in **one horizontal row**.
- Categories now **scroll horizontally**.
- I did **not** change anything else.

## File changed
- `src/pages/Home.jsx`

## Exact mobile behavior added
In `@media (max-width: 768px)`:
- `.soko-cat-grid` → `display:flex`, `flex-wrap:nowrap`, `overflow-x:auto`
- hidden scrollbar styling kept for clean UI
- each category tile fixed width (`84px`) so row scrolls horizontally

## Validation
- Ran `npm run build`
- Result: ✅ successful build
