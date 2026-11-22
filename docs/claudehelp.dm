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
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Fix image messages and the scroll button in the chat view. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the conversation view and its components.

1. IMAGE BUBBLE: print raw the image message component. Cap the image at max-width 280px (220px if the screen is under 400px) and max-height 320px, object-fit: contain on a #f1f3f4 background so it is never cropped, 12px radius, replace the thick green frame with a 2px padding of the bubble colour (sent = green, received = white with 1px #e8eaed border). Time and read ticks overlay the bottom-right corner in a small dark pill (rgba(0,0,0,0.45), white 11px). Keep a caption below the image if one exists. Reserve the image's aspect ratio so the list does not jump while it loads, and show a grey placeholder until loaded and a grey "Image unavailable" panel on error.
2. VIEWER: tapping or clicking an image message opens the same full-screen image viewer built for the Looking For detail view (reuse that component or helper, do not write a new one): dark background, uncropped image, X button, Esc and backdrop-tap to close, pinch/double-tap zoom on phone. If the chat has several images, allow left/right navigation through them with a "1 / 3" counter. Closing returns to the chat at the same scroll position. Add aria-label "View image" and cursor zoom-in.
3. SCROLL BUTTON: position it bottom 12px above the input bar and right 16px inside the message area, shown only when scrolled up more than 200px. Make sure it does not sit on top of message cards when the list is at the bottom (hide it at the bottom).
4. Do not change sending, uploading, receiving, realtime, read receipts, offers or other pages.

Commit as "Chat view: image bubbles, viewer, scroll button", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
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

GOAL: Fix the missing space before the dot on chat rows. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the Chats list row component.

Line 2 must render "<Name> · <price>" with a normal space on both sides of the dot (for example "Wilford James · MWK 39,000"). Find where the name and price are joined, print it raw, and fix it. Do not change anything else.

Commit as "Chats: space before dot", append one line to PROGRESS.md and commit it too.

End with RAW output only:
git log --oneline -3
npm run build
npx eslint <the real row component path> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb

GOAL: On desktop, the add (+) button in the left icon rail should be a plain green plus icon with no circle around it. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly.

1. Find the left icon rail component (Select-String "Select a conversation|icon rail|rail" in src, or the component that renders the home, chat, plus and bell icons). Print the plus button code raw with line numbers.
2. At 769px and up, render the plus as a bare icon: no filled green circle, no background, no box-shadow, no border. Icon colour green #0F9D58, size 26px, strokeWidth 2.25, same 44px tap target and the same alignment as the other rail icons.
3. Hover (only for devices with (hover: hover)): a light #e6f6ed rounded-square background (10px radius) behind the icon. Add title="Post a listing" and aria-label "Post a listing".
4. Phone layout (below 769px): do not change anything. The centre green circle in the bottom nav stays exactly as it is.
5. Keep the same onClick, route and permissions logic. Do not touch any other component or page.

Commit as "Rail: plain green plus on desktop", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -3
npm run build
npx eslint <the real rail component path> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Remove "New Message" and restyle the Chats popup menu so it looks professional on every device. Chats must only start from a product, service, shop or request. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly.

PART 1 - REMOVE NEW MESSAGE (skip any item already done):
1. Get-ChildItem src -Recurse -Include *.jsx,*.js | Select-String -Pattern "New Message|NewMessage|newMessage|new-message|start a new|compose" | Select-Object Path,LineNumber. Print raw, then continue.
2. Remove the "New Message" item from the Chats three-dot menu. Remove other UI that lets a user pick any person and start a blank chat (floating buttons, picker modal). Do NOT remove any route or function that product, service, shop or Looking For request pages use to open a conversation linked to that item. Those Message/Chat buttons must keep working.
3. A direct visit to a blank-chat URL redirects to /chats.
4. Chats empty state text: "Start a chat from a product, service, shop or request", keep the Browse Marketplace and Post a Listing buttons.

PART 2 - RESTYLE THE POPUP MENU (the three-dot menu in the Chats header, and the per-row menu; use ONE shared menu component for both). Colours: green #0F9D58, tint #e6f6ed, text #202124, grey #5f6368, border #e8eaed. Font DM Sans.
1. Items: Starred and Archived only for the header menu (keep the row menu's existing actions). Do not add new actions. Show a count on the right in grey (12px) when the count is above 0 and the data already exists.
2. Item style: 15px, weight 500, #202124, outline icon 20px grey #5f6368 (strokeWidth 1.75, existing icon set, same style for every item; no filled or coloured star). Row height 48px on laptop, 56px on touch. Padding 0 16px, 12px gap between icon and text. Hover (only with (hover: hover)): background #f6fbf8. Pressed: #e6f6ed. A 1px #e8eaed divider only between groups, with 4px vertical padding; no divider lines under every item.
3. PHONE and touch below 769px: render as a bottom sheet: fixed, left 0, right 0, bottom 0, white, 16px top radius, max-height 70vh, a 36x4px grey drag handle centred at the top, padding-bottom env(safe-area-inset-bottom) plus 8px, backdrop rgba(0,0,0,0.4) with a 150ms fade, slide up 200ms (none under reduced motion). z-index above the bottom nav and the install bar. Tap on backdrop or swipe down closes it. A full-width "Cancel" row (grey text, 56px) at the bottom.
4. LAPTOP and tablet 769px and up: a dropdown card anchored under the three-dot button, right-aligned to it, width 224px, white, 1px #e8eaed border, 14px radius, shadow 0 8px 24px rgba(16,24,40,0.12), 8px offset from the button, padding 6px, items with 10px radius. It must stay fully inside the viewport (flip up or shift left if needed) and never overlap or be clipped by the list pane, the tabs or the conversation pane (z-index above both panes; render in a portal at document.body if clipping occurs). Fade in 120ms.
5. Behaviour on all devices: closes on outside click or tap, Esc, scroll of the page, and after choosing an item. Focus moves into the menu on open and returns to the button on close; arrow keys move between items; role="menu" and role="menuitem"; the button has aria-haspopup and aria-expanded. Opening a second menu closes the first. Body scroll is locked while the phone sheet is open.
6. The row menu (long-press on touch, hover button on laptop) uses the same component and the same styling rules.
7. Do not change what any menu action does. Do not change fetching, realtime, unread logic or the open conversation view. Do not touch other pages.

Commit as "Chats: remove New Message, responsive popup menu", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 matches, then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real Chats page and menu component paths> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Refine the open chat conversation view (route /chat/...) so it is clean, compact and professional on phone, tablet and laptop. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the conversation view and its components.

STEP 1 - Find them: Get-ChildItem src -Recurse -Include *.jsx | Select-String -Pattern "last seen|New msgs auto-delete|No more messages" | Select-Object Path,LineNumber. Print raw with line numbers: header, listing card, date separators, message bubble, auto-delete row, input bar. Also find the failing request: Select-String -Pattern "deleted_at" in those files and in src/hooks and src/utils; print the .from('listings').select(...) calls raw. Say which selected column does not exist on listings (check against other working listings selects in the repo), then continue.

STEP 2 - Colours/fonts: green #0F9D58, tint #e6f6ed, text #202124, grey #5f6368 / #80868b, border #e8eaed, chat background keep current, DM Sans body, Sora headings.
1. BUG: fix the 400 on the listings request by removing or replacing the non-existent column (do not run SQL). Handle a deleted/missing listing without errors (show the card as "Listing unavailable").
2. HEADER: back arrow (phone only), 40px avatar (initial fallback), name in Title Case at render time (never ALL CAPS) 16px weight 600, subtitle 12px: "Online" in green #0F9D58 when online, otherwise "last seen <time>" in grey. Green online dot with white ring on the avatar only when online; no grey dot. Right: search icon and three-dot menu, 44px targets. Height about 64px, white, 1px #e8eaed bottom border, sticky.
3. LISTING CARD: one slim row under the header, 56px photo 44px square (10px radius), title 14px weight 600 one line, price 13px green weight 700, small grey 11px type label ("Listing", "Request" or "Service") above the title instead of a chip, chevron on the right, 1px border bottom, white. Whole row tappable as now.
4. DATE SEPARATORS: one centred pill per day only (12px, grey #5f6368, white background, 1px #e8eaed border, 6px 12px padding). Remove the full-width "TODAY" bar. Show "No more messages" only at the very top when history is fully loaded, small grey, above the first date pill and never overlapping it.
5. BUBBLES: text 15px, line-height 1.4, max-width 75% (80% on phones under 400px), padding 8px 12px, 16px radius with a 4px radius on the tail corner. Time inside the bubble, bottom right, 11px, grey (white 70% on green bubbles), with the existing read ticks. Group consecutive messages from the same sender: 2px gap inside a group, 10px between groups. Show the other person's 28px avatar only on the last bubble of a group. Sent bubbles green #0F9D58 with white text, received white with 1px #e8eaed border.
6. AUTO-DELETE: remove the always-visible "New msgs auto-delete" row above the input. Put it in the three-dot menu as "Disappearing messages" showing the current value (Off, 1h, 24h, 7d) and opening the same choices in a small submenu or sheet. Keep the same logic and values. Use the shared menu component and styles built for the Chats popup (bottom sheet below 769px, dropdown above). If a small grey line "Disappearing messages: 24h" is active, show it as a thin banner under the header, otherwise show nothing.
7. INPUT BAR: sticky bottom, white, 1px top border, padding 8px 12px plus env(safe-area-inset-bottom). Left: attach icon (44px). Centre: pill message field (min 44px, grows to 5 lines, 15px). Right: emoji (inside the field) and the mic; the mic turns into a green send button (44px circle) when there is text. Keep the existing dollar/offer icon but move it into the attach menu if the attach opens a menu, otherwise keep it next to attach. Keep the Enter-to-send behaviour on laptop (Shift+Enter for a new line).
8. SCROLL-TO-BOTTOM button: 40px white circle with shadow, 12px above the input bar, right 16px, shown only when scrolled up, with an unread count pill if there are new messages. It must not overlap bubbles' text more than necessary.
9. TABLET and LAPTOP: keep the two-pane layout. The conversation pane content is centred with max-width 900px, bubbles max-width 65%, no back arrow. Phone: full screen.
10. Do not change sending, receiving, realtime, read receipts, attachments, offers, routes or other pages.

Commit as "Chat view: compact header, grouped bubbles, disappearing menu, listings 400 fix", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 findings (including which column caused the 400), then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Finish the chat view refinements. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the conversation view and its components.

1. DATE SEPARATOR: print raw the element rendering "Today". Replace the full-width bar with a centred inline pill (width fit-content, margin 12px auto, 12px text, grey #5f6368, white background, 1px #e8eaed border, padding 6px 12px, 999px radius). "No more messages" stays small grey above it with 12px spacing, never overlapping.
2. BUBBLE TEXT: message text 15px, line-height 1.4 on all widths (find any larger font-size or scaling and remove it), max-width 75% (65% at 769px+).
3. PRICE OFFER CARD: print raw the offer card component. Make it compact: max-width 320px (260px if the screen is under 400px), padding 12px, ONE 1px border (remove the extra green outer wrapper or double border). Layout: row 1 listing photo 36px, title 14px weight 600, row 2 "PRICE OFFER" label 11px grey with the status chip at the right (ACCEPTED, PENDING, etc.), row 3 amount "MWK 30,000" at 22px weight 800 green, with the original price in 12px grey under it if it exists, row 4 action buttons (Accept, Decline, Counter) in one row, 40px tall, equal width, wrapping only if needed. The whole card must be at most about 190px tall. Keep every action and handler.
4. SCROLL BUTTON: place it right 16px, bottom 12px above the input bar (position relative to the message area, not over bubbles when the list is at the bottom), 40px, shown only when scrolled up more than 200px.
5. Do not change sending, receiving, realtime, read receipts, offers logic, routes or other pages.

Commit as "Chat view: date pill, compact offer card, 15px text", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Final polish on the chat view offer card. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the conversation view and offer card components.

1. PRICE FORMAT: print raw where the offer amount and the "Asking" amount are formatted. Show "MWK 30,000" (a normal space between MWK and the number) and "Asking MWK 39,000". Apply the same format anywhere else in the chat view where MWK is followed directly by digits.
2. OFFER TIME: the time and read ticks under an offer card use the same style as normal message times (11px, #80868b, ticks as in bubbles), 4px below the card, right-aligned with it. They must be clearly readable on the chat background.
3. AVATAR: do not render the sender avatar next to messages and cards that the logged-in user sent. Only received messages show the other person's avatar, on the last bubble of a group.
4. WIDTH AND ALIGNMENT: the offer card max-width 320px (260px under 400px screens), width fit to content. Sent offers align right, received offers align left, with the same side margins as text bubbles. It must never overhang the bubble column.
5. Do not change offers logic, actions, sending, receiving, realtime, read receipts or other pages.

Commit as "Chat view: offer card price format, time, avatar, width", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Fix the image message bubble in the chat view: the green frame is far too thick, the image is oversized and cropped. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the conversation view and its components.

1. Print raw the image message component and the bubble wrapper styles it inherits (padding, background, border, min-width, width). Find why the green area is about 20px thick.
2. For image-only messages, the bubble wrapper must have padding 3px, border-radius 14px, background = bubble colour (sent green #0F9D58, received white with 1px #e8eaed border), width fit-content, and NO min-width or text padding. If there is a caption, put it below the image with padding 6px 8px 4px and the time at the bottom right of the caption.
3. Image: max-width 280px (220px below 400px screens), max-height 320px, width auto, object-fit contain, display block, 11px radius, never cropped, on a #f1f3f4 background. Reserve the aspect ratio (use stored width/height if available) so the list does not jump while loading. Grey placeholder until loaded, grey "Image unavailable" panel on error.
4. Time and read ticks for image-only messages sit over the bottom-right corner of the image in a small pill (rgba(0,0,0,0.45), white 11px, 4px 8px padding, 999px radius).
5. Tap or click opens the full-screen image viewer built for the Looking For detail view (reuse that component, do not write a new one): dark background, uncropped image, X button, Esc and backdrop-tap to close, pinch and double-tap zoom on phone, left/right navigation with a "1 / 3" counter when the chat has several images. Closing returns to the same scroll position. Add aria-label "View image" and cursor zoom-in.
6. Scroll-to-bottom button: right 16px, 12px above the input bar, shown only when scrolled up more than 200px, hidden at the bottom.
7. Do not change sending, uploading, receiving, realtime, read receipts, offers or other pages.

Commit as "Chat view: slim image bubbles, viewer, scroll button", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: (1) Offer cards look like normal message bubbles. (2) Restyle the message context menu (right-click on laptop, long-press on touch) to be compact and professional. (3) Fix the image bubble crop and thick frame. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make the edits directly. Edit only the conversation view and its components.

STEP 1 - Print raw with line numbers, then continue without waiting: the offer card component, the bubble wrapper styles, the image message component, the message context menu (Select-String "Auto-delete timer|Reply|Copy" in src), and the shared popup menu component built for the Chats menu.

PART 1 - OFFER CARD AS A BUBBLE
1. Same wrapper as text bubbles: sent = green #0F9D58 with white text, received = white with 1px #e8eaed border; radius 16px with 4px on the tail corner; padding 8px 12px; no extra shadow; max-width 320px (260px under 400px).
2. Row 1: listing photo 32px (8px radius), title 14px weight 600, chevron. Row 2: "Price offer" 12px label with the status chip at the right (translucent white rgba(255,255,255,0.2) with white text on green; green chip on white). Row 3: amount "MWK 30,000" 20px weight 800 (white on green, green on white). Row 4: "Asking MWK 39,000" 12px at 80% opacity. Accept/Decline/Counter buttons in one row, 36px tall, only when actionable. Time and read ticks INSIDE the bubble, bottom right, 11px, like text bubbles. Keep all handlers.

PART 2 - CONTEXT MENU
1. Use the shared menu component and its styling (white, 1px #e8eaed border, 14px radius, shadow 0 8px 24px rgba(16,24,40,0.12), 10px item radius, DM Sans 15px weight 500).
2. Laptop (hover: hover): compact card 240px wide at the cursor, flipping to stay inside the viewport, fade 120ms, portal above both panes, rows 44px. Remove the tall modal and the separate Cancel card. Touch below 769px: bottom sheet (drag handle, 16px top radius, backdrop rgba(0,0,0,0.4), safe-area padding, rows 52px, Cancel row at the bottom).
3. Reaction row at the top: the same 6 emoji, as a single row of 36px buttons with no tile background, hover #f6fbf8, a 1px divider under it.
4. Item icons: 20px outline, strokeWidth 1.75, grey #5f6368, no filled shapes, no coloured tiles. Reply = corner-up-left, Copy = copy, Auto-delete timer = timer, Forward = forward, Download = download, View = maximize-2, Delete = trash-2. Delete items red #d93025 text and icon, no fill, hover #fdecea, separated by a divider.
5. Behaviour: close on outside click, Esc, scroll and after choosing; focus moves in and back; arrow keys move; role="menu"/"menuitem"; only one menu open; body scroll locked on the phone sheet. Same actions and handlers as now.

PART 3 - IMAGE BUBBLE
Image-only bubble: padding 3px, radius 14px, bubble colour background, width fit-content, no min-width. Image max-width 280px (220px under 400px), max-height 320px, width auto, object-fit contain, never cropped, 11px radius, #f1f3f4 behind it. Time and ticks in a small pill over the bottom-right corner (rgba(0,0,0,0.45), white 11px). Tap opens the full-screen image viewer built for Looking For (reuse it).

Do not change sending, receiving, uploading, realtime, read receipts, offers logic or other pages.

Commit as "Chat view: bubble-style offer card, polished message menu, slim images", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view and menu paths> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src
