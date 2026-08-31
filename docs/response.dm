TASK: Reduce the distance from status to categories. Make it match with the other spacings.

WHAT WAS DONE:
- src/pages/Home.jsx: statuses → categories bridge (.status-cat-bridge) height reduced 52px → 36px, matching the other section bridges (categories → featured is 32px, featured → marketplace is 36px).
- Mobile override (max-width 980px) reduced 34px → 28px to match the .bc-bridge mobile height.
- Divider content unchanged (gradient rails + Soko accent dot); only the spacing was tuned.

VERIFIED:
- npx eslint src/pages/Home.jsx — no new issues at the edited lines.
- npm run build — success.


