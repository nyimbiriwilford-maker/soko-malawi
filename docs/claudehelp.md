TASK: Modernize the top section of the Services page (Services.jsx or ServicesPage.jsx — find the file rendering "SOKO MARKETPLACE / Services / X provider(s) available in Malawi" with the district dropdown, notification bell, search bar, All Services / My Services tabs, and Filters / List Service buttons).

STACK: React 19 + Vite, React Router v7, Tailwind CSS v4, Framer Motion, Lucide React icons. Match the Malawian-market aesthetic already used on Login.jsx (Fraunces for display type, IBM Plex for body, flag-color accent palette).

CURRENT STATE (from screenshot):
- Plain white header, small "SOKO MARKETPLACE" eyebrow label above "Services" h1
- District dropdown ("All Districts") + bell icon sit above the header, disconnected from it
- Flat gray search bar below
- "All Services" (grid icon) and "My Services" (list icon, badge count) as plain text tabs
- "Filters" and "+ List Service" as two separate pill buttons below the tabs
- No visual hierarchy, no motion, everything static and left-aligned in a narrow column

MODERNIZE TO:
1. Merge the district selector + notification bell into a single sticky top bar (backdrop-blur, subtle border-bottom) instead of floating separately above the page content.
2. Elevate the "Services" heading with the Fraunces display font, add a subtle gradient or soft blob accent behind the eyebrow label (consistent with the Login redesign's flag-color palette).
3. Restyle the search bar: rounded-full, soft shadow on focus, Lucide Search icon inline, smooth focus-ring transition (Framer Motion or Tailwind transition-all).
4. Convert "All Services" / "My Services" into an animated pill-tab switcher (sliding active-state background via Framer Motion layoutId), not plain text with a badge.
5. Turn "Filters" and "List Service" into a single balanced action row: Filters as an outlined icon+text button (opens a slide-over/drawer, not just a dropdown), "List Service" as the primary filled CTA with the flag-accent color, both with hover/tap micro-interactions.
6. Make the whole top section sticky on scroll (search + tabs stay pinned, main header collapses/shrinks) for mobile PWA usability — this page needs to work well on small screens since we're targeting Malawi mobile users.
7. Add entrance animation (fade+slide, Framer Motion) when the section first mounts.

CONSTRAINTS:
- Don't touch the service card grid/list below this section.
- Keep all existing data bindings, counts, and routing logic — this is a visual/motion pass only, not a logic change.
- Use only Tailwind v4 utility classes already configured in the project (check tailwind.config for the existing flag-color and font tokens before inventing new ones).
- Keep bundle-light: no new dependencies beyond what's already installed (Framer Motion, Lucide are already in use).

OUTPUT: Full updated component code for the top section, plus a short note on any new Tailwind config tokens needed (if any).
