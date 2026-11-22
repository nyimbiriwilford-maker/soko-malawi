Mobile header (mobile view only): remove the circular box styling around the search and notification icons — present both as plain professional icons on the same row (no boxes/borders).

Mobile header (mobile view only): remove the search box below (Row 2) entirely — keep the plain search + notification icons on the same row; the search icon navigates to /search.

Do research on what can be all terms and conditions of this app that a user can agree to first on login before creating an account. On the login page, write those terms for users to agree.

When creating an account with email and password, add a second field to repeat the password (Confirm Password). Enforce a strong password: at least 8 characters including an uppercase letter, a lowercase letter, a number and a special character. Apply the same when resetting the password.

Add real-time password strength validation: as the user types, show a live strength meter and a checklist of the strong-password requirements.

On the page where a user is required to enter the code sent to their email, remove the field that asks for a username.

When the password matching fails while typing in the second password (Confirm Password) field, the field should turn red.

On the signup form, the Continue button should be disabled (inactive) until the Terms & Privacy checkbox is checked. Also, when a person tries to sign up with an email that is already registered, they should be denied with an error message.

When a user signs up with an email that is already registered, show a clear message like "An account already exists with this email. Please sign in instead." instead of the generic "Something went wrong. Please try again."

While testing: make the Continue (proceed) button on the signup form visibly inactive/disabled until the Terms & Privacy checkbox is ticked.

On the login form, detect a valid email address as it is typed. When a valid email is entered (for new or existing users), prompt the user with "Continue as {name}?" (name derived from the email) and they must confirm before proceeding to enter their password.

On the login page, detect the Google account linked to the device/phone (Google One Tap) and prompt the user to continue with Google authentication using the detected email. Uses VITE_GOOGLE_CLIENT_ID.

The login page is not auto-detecting the Google account even though VITE_GOOGLE_CLIENT_ID was placed in Vercel. Diagnose why and make One Tap fire reliably (redeploy required for VITE_ vars; authorized JavaScript origins in Google Cloud Console; user signed into Google; Supabase provider client id must match).

Remove the challs (Calls) category in notifications — just make the call category not visible.

On the home page remove the first status card button to post status. Make the post option for status be found in the post button in bottom nav for mobile view and in header post button for desktop view.

Animate the post status option to look different with status-related animation.

It is not looking professional. Make it look professional with a smooth professional icon.

The icon should be the same as the one placed in the top nav in mobile view for consistency.

Make the popup when clicking the bottom nav in mobile adjust to a proper size based on device. Don't let it get hidden at the top by the top header.

The popup on my short phone is still long and gets hidden by the top header. Make the option sizes adaptive to shrink based on mobile size so the whole popup is visible with no information hidden.

On home page statuses section: on landing/refresh do not show the status create button — only show posted status cards. Show the create card when scrolling back to it, or when no status is posted, or when only one person has posted (mobile fits two status cards: first = create, second = the posted one). Goal: maximise posted statuses visibility on mobile.

On the status page, don't show distance on the status feed card. Also generate reels from the most-viewed status videos. Reels should be placed randomly inside the status section — while scrolling a person should find the reels card, and tapping it should play reels of different current status videos. Make the reels section look professional, use SokoMw theme.

On the same home page. Don't change anything — just change the arrangement. Statuses should come just after the top banner section, followed by the shop categories section.

On the same place a proper transition and distance from where status section ends to where categories section starts.

Reduce the distance from status to categories. make it match with the other spacings

JOBS ARE POSTED IN ADMIN ONLY, BUT WHEN POSTING JOB. IN JOB POST IN ADMIN, IT IS NOT WELL STAYLED. FIX IT. STYLE IT PROPELY
Home statuses Phase 2c: fix only the TOP zone of Home status cards: two rows (avatar + in-flow count circle; full-width name and relative time only), 30px phone/32px 769px+ avatar, 13px phone middle text, no location, no overlap on 130x190 or 150x220 cards.
Home statuses: scrolling behaviour, more-cards cue, loading state: 13 query/12 render, arrows 1100px+, fades, view-all card, skeleton.
GOAL: (1) The Looking For list loads in batches sized per device. (2) Images in the request detail modal open in a full-screen viewer. Branch wip/home-hero-premium. STEP 1 raw findings; STEP 2 batch loading (fetch newest 150 active, per-device batches 10/16/24 via matchMedia, IntersectionObserver sentinel 300px before end, Show more fallback, skeletons, reset visible count, Showing X of Y, full-set tab counts); image viewer (full-screen, contain, close/X/Esc/backdrop, gallery counter/swipe/arrows/keyboard/thumbnails, pinch/double-tap zoom, spinner/error, cursor zoom-in and focusable main image). Commit as "Looking For: batch loading per device, image viewer", append one line to PROGRESS.md and commit it too.
GOAL: Redesign the Notifications page (route /notifications) compact, scannable, clean on phone/laptop. Branch wip/home-hero-premium. STEP 1 raw findings for page layout/header/search/tabs/date groups, row component, side rails. STEP 2: compact 72px tappable rows with avatars/icon badges, remove chips/emojis/unverified/product chip, unread tint/dot, subtitle unread count, Mark all read, sticky date groups in white containers, scrollable tabs, laptop feed max-width 720px with no rails, per-tab empty state, 6 skeleton rows. Do not change fetching/realtime/mark-read/routes/tap behavior. Commit as "Notifications: compact rows, unread state, remove side rails", append one line to PROGRESS.md and commit it too.
GOAL: Two small fixes on the Notifications page. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make edits directly. Edit only the Notifications page and its row component. 1. TITLE WIDTH ON PHONE: title cut short because time and dismiss x take too much room. On phone hide dismiss x button from row (keep on laptop hover only, keep handler). Give time element flex: none, 12px, title remaining width min-width:0 and ellipsis. 2. SYSTEM ROWS: for view, offer, deal, order and system notifications with no real sender, do not render initial avatar; show 44px coloured circle with type icon (views purple #7c4dff on #f1ecff, offers amber on #fff7e0, deals blue on #e8f0fe, orders green on #e6f6ed, system grey on #f1f3f4). Use initial only with real sender name. No fetching/realtime/mark-read/routes/tap changes. Commit as "Notifications: wider titles on phone, type icons for system rows", append one line to PROGRESS.md and commit it too.
GOAL: Fix the "Install SokoMw" bar so it never covers the bottom nav and fits on one row. Branch wip/home-hero-premium (check with git branch --show-current). STEP 1 find with Get-ChildItem src -Recurse -Include *.jsx | Select-String -Pattern "Install SokoMw|Add to home screen"; print component raw with line numbers. STEP 2: phone below 769px fixed left/right 0 bottom = bottom nav height (~64px) + env(safe-area-inset-bottom), z-index just below bottom nav; one row max 56px with 36px logo, 14px/700 title, grey ellipsis subtitle, nowrap Not now text button and 40px green #0F9D58 Install pill; laptop one row max 64px. Store dismissal timestamp after Not now and suppress 14 days (try/catch); after successful install never show again. Add bottom padding equal to bar height only while visible. Do not change other components/pages. Commit as "Install bar: compact, above bottom nav, 14 day dismiss", append one line to PROGRESS.md and commit it too.
GOAL: Polish the typography, spacing and copy of the Notifications page. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Notifications page and its row component. Show the current row code raw first, then continue. 1. LAPTOP WIDTH: at 1100px and up, header, search, tabs and feed in one centred column max-width 720px margin 0 auto. 2. BACKGROUND: flat #f8f9fa, remove gradient/tint behind groups. 3. TYPE: group header 12px/700/0.04em #80868b; title 15px/600 #202124 DM Sans not Sora; body 14px/400 #5f6368 lh1.4; time 12px #80868b; unread title 700; same phone/laptop. 4. NAMES: Title Case at render time only. 5. COPY: views title "<Name> viewed your listing" (Someone if unknown), body "<listing> · MWK 5,000", never repeat sender/listing. 6. MERGE: consecutive message notifications from same sender within same date group collapse to one row, title sender, body latest message text, small green count pill under time when >1, tap same place as latest, mark all through existing handler. 7. BADGE: 18px, white 2px ring, 14px icon. 8. SPACING: row padding 14px 16px, 12px avatar/text gap, 16px between groups, row <=~76px. Commit as "Notifications: typography, copy, merged messages, centred laptop column", append one line to PROGRESS.md and commit it too.
GOAL: Fix 4 remaining Notifications issues. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only Notifications page and row component. 1. VIEW NAME: title "<Name> viewed your listing"; find name in data/payload, sender/actor profile, or original body text such as "WILFORD JAMES viewed ..."; print notification object fields raw for one view notification first; Title Case; "Someone" only if none. 2. ROW HEIGHT: rows ~140px; padding 12px 16px; remove extra margins/min-heights/line-heights; target 64-76px with one-line body; merged rows same height. 3. PHONE TITLE: wrap to 2 lines (line-clamp 2) on phone, one line on laptop; time top right flex:none. 4. BADGE: 2px white ring via box-shadow 0 0 0 2px #fff and solid tinted background. Do not change fetching, realtime, mark-read, routes or tap behaviour. Commit as "Notifications: viewer name, tighter rows, 2-line titles on phone", append one line to PROGRESS.md and commit it too.
