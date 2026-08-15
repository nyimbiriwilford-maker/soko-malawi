# SokoMW Mobile Header — Phased Redesign

Use the attached reference image as the **visual quality and design-direction reference**.

The goal is to redesign the existing SokoMW mobile header into a **premium, smart, modern marketplace header** while preserving all existing functionality.

Do NOT redesign everything at once.

Implement the work in the following phases.

---

# PHASE 1 — AUDIT CURRENT HEADER

Before changing any code, inspect the existing SokoMW mobile header.

Identify:

* Header component/file
* Mobile breakpoint
* Logo implementation
* Search implementation
* Notification button
* Profile/account button
* Existing category/action buttons
* Existing navigation
* Sticky/fixed behaviour
* Existing CSS/Tailwind styles
* Existing design tokens/colors
* Existing responsive behaviour

Determine exactly which files need to be modified.

### Important

Do not modify anything yet.

Do not touch unrelated components.

At the end of this phase, report:

1. Files responsible for the mobile header
2. Current structure
3. Existing functionality that must be preserved
4. Recommended implementation approach

Wait for the next phase before making changes.

---

# PHASE 2 — REDESIGN THE VISUAL FOUNDATION

Now redesign only the **visual structure/background of the mobile header**.

Use the reference image for inspiration.

Create a premium visual atmosphere using:

* Existing SokoMW green
* Clean white/neutral background
* Very subtle green gradient
* Extremely subtle decorative circles/organic shapes
* Soft depth
* Generous but controlled whitespace

Do NOT add large illustrations.

Do NOT copy the reference image.

Do NOT create a large hero banner.

The header must remain compact enough for a marketplace.

### Target feeling

The user should immediately feel:

**Premium + modern + trustworthy + clean**

rather than:

**basic header + generic app UI**

Preserve all existing functionality.

Test the layout at multiple mobile widths.

---

# PHASE 3 — REDESIGN TOP NAVIGATION

Redesign the top row.

Structure:

LEFT:

* SokoMW logo

RIGHT:

* Notification
* Profile/account

Requirements:

* Clean spacing
* Proper thumb-sized touch targets
* Subtle circular/rounded backgrounds where appropriate
* Small unread notification indicator
* No oversized buttons
* No unnecessary borders
* Strong visual balance

Keep the existing logo.

Do not redesign the SokoMW brand identity.

Add subtle interaction feedback:

* Hover where applicable
* Press state
* Smooth transition
* Active state

Keep animations fast and subtle.

---

# PHASE 4 — MAKE SEARCH THE HERO CONTROL

Redesign the search bar so it becomes the strongest interactive element in the header.

Requirements:

* Full available width
* Approximately 46–52px height
* Comfortable touch target
* Clean search icon
* Placeholder: "Search anything..."
* Soft rounded corners
* Very subtle elevation
* Very subtle border if needed

The search bar should visually stand out without looking like a giant pill.

### Focus state

When the user taps search:

* Smoothly transition to active state
* Clearly communicate focus
* Do not cause layout jumping
* Do not break existing search functionality
* Preserve keyboard behaviour
* Preserve existing search results/dropdown behaviour

Do not rebuild the search logic unless necessary.

Only improve its presentation and interaction.

---

# PHASE 5 — SMART QUICK ACTIONS

Redesign the category/action shortcuts beneath the search.

Use the existing SokoMW actions/categories.

For example:

Products
Shops
Jobs
Services

Design them as lightweight, premium quick actions.

Each should contain:

ICON
LABEL

Avoid large cards.

Avoid excessive borders.

Avoid huge circles.

Use subtle branded backgrounds and clean icons.

If the available width is insufficient:

* Allow horizontal scrolling
* Hide the scrollbar visually
* Keep scrolling smooth
* Make sure the first and last items remain discoverable

The actions should feel like **smart navigation shortcuts**, not traditional category cards.

---

# PHASE 6 — PREMIUM SPACING AND HIERARCHY

Now refine the entire header.

Pay particular attention to:

* Vertical spacing
* Horizontal padding
* Logo size
* Search position
* Search height
* Gap between search and actions
* Action spacing
* Header-to-content spacing

The hierarchy should be:

1. Brand/account controls
2. Search
3. Quick discovery actions
4. Marketplace content

Do not allow the header to consume too much vertical screen space.

The user should reach marketplace content quickly.

Use whitespace instead of unnecessary borders and containers.

---

# PHASE 7 — MICRO-INTERACTIONS

Add subtle premium interactions.

### Search

* Focus transition
* Slight elevation change

### Quick actions

* Press feedback
* Small scale/opacity transition
* Active state

### Notification

* Smooth badge appearance
* No excessive animation

### Profile

* Subtle press feedback

Animation guidelines:

* Fast
* Smooth
* Subtle
* Professional

Do NOT use:

* Bouncing animations
* Large scaling
* Flashing
* Excessive motion
* Decorative animations that slow down navigation

---

# PHASE 8 — RESPONSIVE REFINEMENT

Test the redesigned header on:

### Small phones

Ensure:

* No clipping
* No overlapping
* Search remains usable
* Icons remain accessible
* Quick actions can scroll horizontally

### Standard phones

Use the intended spacing and proportions.

### Large phones

Allow slightly more breathing room without making the header oversized.

### Tablets

Do not allow the mobile layout to become stretched and awkward.

Respect the existing responsive breakpoint and desktop design.

---

# PHASE 9 — FUNCTIONALITY REGRESSION TEST

Before declaring completion, verify that the redesign did NOT break:

* Search
* Search suggestions/results
* Notifications
* Profile/account
* Navigation
* Category actions
* Authentication state
* Sticky header behaviour
* Scrolling
* Existing marketplace content

Also check:

* No console errors
* No React warnings caused by the changes
* No horizontal overflow
* No layout jumping
* No broken click targets
* No unexpected desktop changes

---

# PHASE 10 — VISUAL QA AND FINAL POLISH

Compare the final result against the attached reference image.

Do NOT compare exact elements.

Compare the **design quality**.

Check:

* Does it feel premium?
* Does it feel modern?
* Does it feel intelligent?
* Is the search immediately obvious?
* Is the hierarchy clear?
* Is there enough whitespace?
* Is the green branding used intelligently?
* Does the header feel visually interesting without being busy?
* Does it still feel like SokoMW?
* Can users reach marketplace content quickly?

If anything feels generic, cluttered, oversized, or amateur, refine it.

---

# FINAL REQUIREMENT

At the end, report:

### Files changed

List every file modified.

### What changed

Briefly describe the changes.

### Functionality preserved

Confirm which existing functionality was tested.

### Responsive testing

Confirm which viewport sizes were tested.

### Errors

Report any remaining console/build/lint errors.

### Final assessment

Give the redesign a score out of 10 for:

* Visual quality
* Usability
* Mobile responsiveness
* Premium feel
* SokoMW brand consistency

Do not claim the implementation is complete until the actual interface has been tested.

## Critical instruction

**Do not redesign the desktop header.**

This task is specifically focused on the **mobile header** unless an existing shared component makes a small unavoidable change necessary.

Preserve the existing SokoMW functionality and brand identity while substantially improving the mobile visual experience.
