TASK: Jobs are posted in Admin only, but when posting a job in the Admin job post form, it is not well styled. Fix it and style it properly.

ROOT CAUSE:
- The Admin Jobs tab renders the shared PostJobForm component (src/pages/Jobs/PostJobForm.jsx), which styles itself with classes from src/pages/Jobs/Jobs.css (.post-form-card, .form-input, .form-section-title, .img-upload-btn, .post-form-ai-*, .form-submit-btn, etc.).
- Admin.jsx imported PostJobForm but NOT Jobs.css — only the Jobs page (via Home.jsx / Jobs/index.jsx) imported it. So inside Admin every form class was unstyled: bare inputs, no card, no section dividers, no spacing.

WHAT WAS DONE:
1. src/pages/Jobs/PostJobForm.jsx — the form now imports its own stylesheet (import './Jobs.css') so it carries its styles wherever it is rendered (Admin, Jobs page, future hosts).
2. src/pages/Admin.jsx (Jobs tab) — wrapped the PostJobForm view in a centered, readable column (maxWidth 760, margin auto) so the form card doesn't stretch edge-to-edge across the wide Admin content area; the existing Back to Jobs button is kept.
   No other Admin styles or Jobs page behavior changed.

VERIFIED:
- npx eslint on PostJobForm.jsx and Admin.jsx — only pre-existing errors (unused imports, hook-order warnings); none from these edits.
- npm run build — success.
- CSS leak check: the :root variables and .jobs-* classes in Jobs.css are scoped to the Jobs feature (MyJobs/JobModal/PostJobForm are the only var(--...) consumers and all render only under the Jobs page/Admin Jobs tab), so importing it in PostJobForm cannot restyle other Admin tabs or app pages.
