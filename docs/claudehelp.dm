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
GOAL: On Notifications, "viewed your listing" rows show the viewed listing's photo in the avatar slot. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Notifications page and its row component.

STEP 1 - Print raw one view notification object (its data/payload fields) and find where the listing id and listing image are available (notification data, a join, or the listing id used for the existing click-through). Then continue.

1. For view notifications only: replace the purple eye circle with a 44px rounded square (border-radius 10px, object-fit cover, 1px #e8eaed border) showing the listing's first image. Keep the small eye badge at the bottom-right (18px, white 2px ring, purple #7c4dff on #f1ecff).
2. Get the image from the notification data if it exists. If not, fetch it with ONE batched query for all view-notification listing ids on the page (select id, images from listings where id in (...)), cached in a Map so each id is fetched once. No per-row queries. Handle images stored as an array of URLs or as an object with url; use the first one. If the listing was deleted or the image fails to load (onError), fall back to the existing purple eye circle. No broken-image icon.
3. Do not change messages, offers, deals, orders or system rows.
4. Row height: on phone allow the title to wrap to 2 lines maximum (line-clamp 2) and keep the body to one line with ellipsis, padding 12px 16px, so the view row is at most about 76px. Currently the title wraps to 3 lines.
5. Do not change fetching of notifications, realtime, mark-read logic, routes or tap behaviour. Do not touch other pages.

Commit as "Notifications: listing photo on view rows", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 findings, then:
git log --oneline -4
npm run build
npx eslint <the real page and row component paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
GOAL: Remove the Orders and System category tabs from the Notifications page. Keep All, Messages, Listings, Offers and Deals. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Notifications page and its row component.

1. Find the tab list (Select-String "Orders" in the Notifications page) and print it raw with line numbers, then continue.
2. Remove the Orders and System tabs from the tab row. Do the same in the Filters panel if it lists categories.
3. Orders and system notifications must still show under the All tab. Do not delete them from the data, and do not change how any notification is fetched, grouped or tapped.
4. If the user opens the page with a saved or URL-selected tab of Orders or System, fall back to All.
5. Messages, Listings, Offers and Deals keep their current filtering rules. If Orders-type notifications were previously matched by the Deals or Listings filter, leave that matching exactly as it is.
6. Do not touch other pages.

Commit as "Notifications: remove Orders and System tabs", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real page path> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
GOAL: Replace the count pill on merged message rows with clearer time and unread logic, and fix the see-through header. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Notifications page and its row component.

1. COUNT PILL: show the green pill only when the merged row contains unread notifications, and make the number the UNREAD count (not the total). When all are read, show no pill.
2. TIME: the time stays at the top right of the row, 12px grey. Format by age of the latest item: today = clock time (08:54), yesterday = "Yesterday", within 7 days = weekday name, older = "11 Nov". Do not show the time twice on a row.
3. MERGED BODY: for a merged row with more than one message, the body shows the latest text, then " · +N earlier" in lighter grey (#80868b), where N = total minus 1. Single messages show the text only.
4. HEADER: the sticky header (back button, title, search, tabs) needs a solid white background (#fff) and z-index above the list, with a 1px #e8eaed bottom border. Rows must never show through it while scrolling, on phone and laptop. Tabs row included.
5. Do not change fetching, realtime, mark-read logic, routes or tap behaviour. Do not touch other pages.

Commit as "Notifications: unread-only count, clearer time, solid header", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real page and row component paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
GOAL: Fix 5 remaining issues on the Chats list. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Chats list page and its row component.

1. IMAGES: print raw how the row image is chosen. Request chats must show the request's first image (image_url or image_urls[0]), product chats the listing's first image, service chats the service's first image. Use the type icon fallback ONLY when no image exists or it fails to load. If the image fields are not available on the chat object, fetch them with ONE batched query per type for all chat ids on the page (cached in a Map), never per-row queries.
2. PHONE WIDTH AND HEIGHT: on phone the row content must span the full row width (no stray right padding or fixed width), the time sits at the far right of line 1 with padding 16px, and the row is at most about 88px tall (padding 12px 16px, no extra margins, line-heights 1.3). Titles and previews truncate only at the real edge.
3. PERSON AVATAR: make the overlay avatar 24px with a 2px white ring and a visible initial (12px, weight 700, green on #e6f6ed); on very small phones (under 360px) 20px.
4. NO PRODUCT: when a chat has no linked product/request/service (currently titled "New chat"), show the other person's name in Title Case as the title, no second line, and the avatar as the main 56px image (circle, with the initial fallback).
5. MENU: remove any visible three-dot on rows at rest. Show it only on hover for devices with (hover: hover), and open the same menu on long-press (500ms) for touch devices. Do not change what the menu actions do.

Do not change fetching of chats, realtime, unread logic, routes, the open conversation view or tap behaviour. Do not touch other pages.

Commit as "Chats: real images, full-width rows, avatar and menu fixes", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real page and row component paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
GOAL: Fix the chat row price hiding on phone and find the failing images. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Chats list page and its row component.

1. PRICE: print raw the CSS/logic that hides the price on phone. The price part of line 2 ("Wilford James · MWK 1M") must show on all widths, and be hidden ONLY below 360px (max-width: 359px). Fix the breakpoint if it fires at a larger width.
2. IMAGES: for the chats titled Mandasi and Nyumba, print the raw image URLs the row uses (image_url / image_urls[0]) and whether the URL host and path match how other working images are built (check how Looking For request cards build their image URL, e.g. getR2Url or a public base URL). If the row builds the URL differently from the Looking For cards, use the same helper so both match. If the stored value is simply a missing file, change nothing and tell me.
3. Do not change fetching, realtime, unread logic, routes, tap behaviour or other pages.

Commit as "Chats: price on phone, image URL helper", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the findings for 1 and 2, then:
git log --oneline -4
npm run build
npx eslint <the real page and row component paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
GOAL: Remove the extra gap between the title and the person's name on unread chat rows. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the Chats list page and its row component.

1. Print raw the row layout code where the time and the unread pill are rendered.
2. The right column of line 1 must contain ONLY the time (12px grey, top right, no wrap). Remove the unread pill from that column.
3. Render the unread pill at the right end of line 3 (the message preview line): the preview takes the remaining width (min-width: 0, ellipsis), the pill is flex: none, margin-left 8px, green #0F9D58, white 11px text, min 20px wide, 20px tall, vertically centred.
4. Line 1, line 2 and line 3 use the same line-height (1.3) and no extra margins whether the chat is read or unread. An unread row must be exactly as tall as a read row with the same content.
5. Apply the same layout to the no-product person rows (the ones titled with the person's name).
6. Keep unread styling: title weight 700, preview #202124, row background #f6fbf8.
7. Do not change fetching, realtime, unread logic, routes, tap behaviour or other pages.

Commit as "Chats: unread pill on preview line, no row gap", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real page and row component paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real page path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
