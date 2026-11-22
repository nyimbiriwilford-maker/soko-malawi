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

GOAL: Finish the unified message context menu in the chat view so image messages and text messages use one polished menu, and finish the slim image bubble. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make edits directly. Edit only the conversation view and its components.

STEP 1 - Print raw with line numbers, then continue without waiting: every component that renders "Choose an action for this image", "Delete for everyone", "Auto-delete timer" and "Reply" in the conversation view, the shared popup menu component built for the Chats menu, and the image message component.

1. Replace the remaining per-image action sheet with the same shared popup menu used by text messages. Keep the existing actions and handlers: View, Forward, Download, Delete for me, and Delete for everyone only when the logged-in user sent it. Hide actions that do not apply. Use the same outline icons and styling as the text message menu: View = maximize-2, Forward = forward, Download = download, Reply = corner-up-left, Copy = copy, Auto-delete timer = timer, Delete = trash-2. Delete for everyone uses trash-2 with a small x badge. No emoji, filled or coloured tiles.
2. Shared menu polish: laptop card stays 240px at the cursor, viewport flip/shift, portal above both panes, fade 120ms, white, 1px #e8eaed border, 14px radius, shadow 0 8px 24px rgba(16,24,40,0.12), 6px padding, 10px item radius, DM Sans 15px weight 500, 44px rows, no title/subtitle/Cancel card. Touch below 769px uses the bottom sheet with drag handle, 16px top radius, rgba(0,0,0,0.4) backdrop, safe-area padding, 52px rows, a small header with a 40px thumbnail and grey type label ("Image" or "Message"), and one Cancel row.
3. Delete items are red #d93025 text and icon, no fill, hover #fdecea, separated by a divider. Text menu keeps the six reactions as 36px buttons with no tile background and a divider under the row.
4. Finish the image bubble: padding 3px, radius 14px, bubble colour background, width fit-content, no min-width; image max-width 280px (220px under 400px), max-height 320px, width auto, object-fit contain, never cropped, 11px radius, #f1f3f4 background; time and ticks in a small dark pill over the bottom-right corner. Tap opens the existing full-screen image viewer from Looking For. Keep captions below the image and reuse the viewer gallery for multiple images with a 1 / 3 counter.
5. Close the menu on outside click, Esc, scroll and after choosing; focus moves in and back; arrow keys move; role="menu"/"menuitem"; only one menu open; body scroll locked on the phone sheet. Do not change sending, uploading, receiving, realtime, read receipts, offers, routes or other pages.

Commit as "Chat view: one polished message menu, slim image bubbles", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the STEP 1 raw snippets, then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view and menu paths> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Redesign the chat composer (typing box) and its related parts so it is compact, clear and professional on every device, using the icon set below. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the conversation view and its components.

STEP 1 - Print raw with line numbers, then continue without waiting: the input bar component (Select-String "Message…|Message\.\.\." in src), the attach button and menu, the offer (dollar) button, the mic/recording code, the emoji trigger, any reply-preview and attachment-preview code, the scroll-to-bottom button, and the message context menu icons. Also check which of these Lucide icons exist in the installed lucide-react version: CirclePlus, Image, Camera, FileText, HandCoins, BadgeDollarSign, SmilePlus, Mic, SendHorizontal, PackageCheck, MessageCircleQuestion, CornerUpLeft, ChevronDown, Reply, Copy, Forward, Download, Maximize2, TimerReset, Timer, Trash2, Eraser. Use the fallback where one is missing: HandCoins -> BadgeDollarSign, TimerReset -> Timer, Eraser -> Trash2.

STEP 2 - Colours/fonts: green #0F9D58, tint #e6f6ed, text #202124, grey #5f6368 / #80868b, border #e8eaed, DM Sans. Icons: Lucide only, outline, strokeWidth 1.75, no emojis, no filled shapes (except the white send arrow inside the green circle). Size 22px in the bar, 20px in menus. Grey #5f6368 by default, green for send and active states, red #d93025 only for destructive actions.

1. BAR: sticky bottom, white, 1px #e8eaed top border, padding 8px 12px plus env(safe-area-inset-bottom). On 769px+ the content is centred with max-width 900px, matching the message column.
2. FIELD: pill, background #f1f3f4, no border, radius 22px, min-height 44px, grows to 5 lines then scrolls, 15px text, padding 10px 14px, placeholder "Message" in #80868b. Focus: 2px #0F9D58 ring with white background. SmilePlus emoji button inside the field at the right, 32px.
3. LEFT BUTTON: one 44px CirclePlus button (hover tint #e6f6ed) that opens the shared popup menu (bottom sheet below 769px, dropdown above) with: Image "Photo", Camera "Camera" (touch devices only), FileText "File", HandCoins "Make an offer" (only when the chat is linked to a listing or request and offers are allowed today). Keep the same upload and offer handlers. Remove the loose paperclip and dollar buttons from the bar.
4. RIGHT BUTTON: 44px circle. Field empty = Mic (grey, no fill). Text or attachment present = green #0F9D58 circle with a white SendHorizontal icon. Enter sends on laptop, Shift+Enter adds a line.
5. QUICK REPLIES: only on chats linked to a listing/request/service with fewer than 3 messages in total, show a horizontally scrollable chip row above the bar (36px chips, white, 1px #e8eaed border, 14px text, 16px icon on the left): PackageCheck "Is this still available?", HandCoins "Make an offer", MessageCircleQuestion "What's your last price?". Text chips fill and send the message through the normal send handler; "Make an offer" opens the existing offer flow. Hide the row once the user types or after 3 messages.
6. REPLY PREVIEW: a 48px strip above the field with a 3px green left bar, CornerUpLeft icon, sender name (12px, green, weight 600), one-line quoted text (13px grey) and an X (44px target).
7. ATTACHMENT PREVIEW: selected photos as 56px rounded thumbnails in a strip above the field, each with a small X and an upload progress ring; files show a FileText icon and a name chip.
8. RECORDING: replace the field with a bar showing a red pulsing dot (no icon), the timer (mm:ss), "Slide to cancel" in grey on touch (a Cancel text button on laptop), and the green send circle. Pulse off under reduced motion.
9. DISABLED: if the chat is closed or the user is blocked, replace the bar with one grey line saying why, no input.
10. SCROLL BUTTON: 40px white circle, soft shadow, ChevronDown icon, right 16px, 12px above the bar (and above the quick-reply row if shown), shown only when scrolled up more than 200px, hidden at the bottom.
11. MESSAGE MENU ICONS (the shared message menu): Reply = Reply, Copy = Copy, Forward = Forward, Download = Download, View = Maximize2, Auto-delete timer = TimerReset, Delete for me = Trash2, Delete for everyone = Eraser. Delete items red text and icon.
12. All tap targets at least 44px on touch. aria-labels: "Attach", "Send message", "Record voice message", "Scroll to latest".
13. Do not change sending, uploading, receiving, realtime, read receipts, offers logic, routes or other pages.

Commit as "Chat view: compact composer, plus menu, quick replies, new icons", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 findings (including which icons were missing), then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real conversation view and composer paths> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Redesign the Looking For posting modal (RequestComposer) so it is clean and professional, and the Post button is always visible on phone and laptop. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only src/components/LookingFor/RequestComposer.jsx and its styles.

STEP 1 - Print raw with line numbers, then continue without waiting: the modal wrapper and its styles (position, z-index, height, overflow), the field list in order, the duration options, the GPS line, the submit button, and the bottom nav z-index (Select-String "zIndex|z-index" in the nav component and app css).

STEP 2 - Colours/fonts: green #0F9D58, tint #e6f6ed, text #202124, grey #5f6368 / #80868b, border #e8eaed, DM Sans body, Sora headings.
1. PHONE (below 769px): bottom sheet, fixed, left 0, right 0, bottom 0, height 100dvh minus 24px, 16px top radius, white, z-index ABOVE the bottom nav and the install bar (use a portal to document.body if needed), backdrop rgba(0,0,0,0.4), body scroll locked while open. Layout is a flex column: pinned header, scrolling body (flex 1, overflow-y auto, -webkit-overflow-scrolling touch, padding 16px), pinned footer.
2. HEADER (pinned): drag handle 36x4px, title "Post a request" (Sora 18px, 800), grey subtitle "Tell sellers what you need", X close button 44px. 1px #e8eaed bottom border.
3. FOOTER (pinned, always visible): white, 1px #e8eaed top border, padding 12px 16px plus env(safe-area-inset-bottom). One full-width green #0F9D58 button "Post request", 52px tall, 16px weight 700, white text, 14px radius. Disabled (grey #dadce0) until the title has text; spinner and "Posting..." while submitting. Keep the existing submit handler and validation. Show validation errors inline under the field and scroll to the first error.
4. KEYBOARD: use visualViewport (or 100dvh) so when the phone keyboard opens the footer stays visible above it and the focused field scrolls into view.
5. FIELDS (keep every existing field, same order, same names): What are you looking for (text, 16px so iOS does not zoom, 48px tall, label 13px weight 600 above it, no uppercase labels), Budget and Category side by side (budget with "MK" prefix, thousands separators as you type; category select 48px), Description (optional, 3 lines), image upload (optional, 72px thumbnails with X), Cities/location, Urgency. Labels sentence case 13px weight 600 #202124, helper text 12px #80868b, field radius 12px, 1px #e8eaed border, focus ring 2px #0F9D58.
6. DURATION: replace the large cards with one row of compact chips (40px, 1 day, 3 days, 7 days, 14 days, 30 days, Custom, No expiry), wrapping to two lines if needed, 7 days selected by default with a "Recommended" tiny label. Below it, one grey line: "Expires <date>. You can mark it fulfilled earlier." Custom opens a small number input. Keep the same values and logic.
7. LOCATION LINE: keep the GPS capture line ("Finding your location..." / "Location captured" / "Try again") as a slim row near the top of the body.
8. LAPTOP (769px and up): centred modal, width 560px, max-height 90vh, 16px radius, shadow 0 16px 48px rgba(16,24,40,0.2), same pinned header and footer, body scrolls. Esc and backdrop click close it (confirm if the form has unsaved text).
9. Closing with unsaved text on phone asks once: "Discard this request?" with Keep editing and Discard.
10. Do not change what gets saved, the GPS logic, expiry logic, fetching, realtime or other pages.

Commit as "Looking For: composer sheet with pinned Post button", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 findings, then:
git log --oneline -4
npm run build
npx eslint src/components/LookingFor/RequestComposer.jsx | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint src/components/LookingFor/RequestComposer.jsx --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Fix the broken quick-reply chips above the chat composer, and two small details in the listing card. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the chat view (src/pages/Chat.jsx and src/styles/chat-thread.css).

1. Print raw with line numbers the quick-reply row and chip styles, then fix:
   - Row: display flex, gap 8px, overflow-x auto, scrollbar hidden, padding 8px 12px, white-space nowrap, -webkit-overflow-scrolling touch, no wrapping, no overlap.
   - Chip: flex: 0 0 auto, width auto, min-width 0 not applied, height 36px, padding 0 14px, border-radius 999px, white background, 1px #e8eaed border, 14px DM Sans weight 500, white-space nowrap, display inline-flex, align-items center, gap 6px, 16px Lucide icon on the left (PackageCheck "Is this still available?", HandCoins or BadgeDollarSign "Make an offer", MessageCircleQuestion "What's your last price?"). Remove any fixed width, height-equals-width or aspect-ratio rules.
   - The row must sit directly above the composer with no gap and must not overlap the message list.
2. Listing/request card under the header: show the budget as "MWK 200,000" (thousands separators, "MWK 1M" above one million), never a raw number.
3. Request thumbnail: replace the magnifier emoji with a Lucide Target icon (22px, strokeWidth 1.75, green #0F9D58) on a #e6f6ed rounded square.
4. Do not change sending, offers logic, other chat parts or other pages.

Commit as "Chat view: fix quick-reply chips, format budget", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint src/pages/Chat.jsx | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src


GOAL: Rebuild the desktop top navigation for 1100px and up only. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make all edits directly. Do not change phone or tablet layouts below 1100px at all.

STEP 1 - Before editing, print the current code raw with line numbers for: the desktop header markup, search bar, nav row and styles, unread counts source for chats and notifications, and account avatar/menu. Then inspect node_modules/lucide-react to confirm the needed icons exist. If any is missing, use the stated fallback.

1. HEADER: two clean rows, solid white, fixed shadow only after 8px scroll, above content. Row 1 height 64px, max-width 1400px, centered: logo left, centered search, right action group with 12px gaps. Row 2 height 44px with top border. Hide tagline. Keep same labels/routes. Shorten only Statuses (Stories) to Statuses if the row would wrap.
2. ICONS: Lucide only in header, strokeWidth 1.75. Chats MessageCircle 22, Alerts Bell 22, Post Plus 18, Account ChevronDown. Action icon buttons 40px, grey #5f6368, hover #f1f3f4, no text labels. Avatar 36px circle, 1px border #e8eaed, small ChevronDown. Post white text 14px/700, green #0F9D58 pill, 40px high, 16px horizontal padding, Plus 18 + "Post", same handler. Pillar icons: Marketplace ShoppingBag, Shops Store, People Looking For UsersRound, Services Wrench, Stories/Statuses Clock fallback, Verification BadgeCheck fallback ShieldCheck. Active state green #0F9D58 text + underline only.
3. SEARCH: 44px high, radius 999px, bg #f1f3f4, no border, 18px Search icon #5f6368, placeholder exactly "Search products, services, shops" in #80868b 15px, "/" hint chip right with 12px grey text radius 6 that hides on focus. Pressing "/" outside input focuses search. Remove green Search button; Enter submits. Clear X when text. Focus: white bg, 2px green border #0F9D58, soft shadow. Dropdown: white, 1px #e8eaed, radius 14px, shadow, 8px below, rows 44px with 16px Clock icons for recent searches; closes on Esc/outside.
4. MENU: click avatar opens existing account menu, restyle shared popup menu: white, 1px #e8eaed, radius 14px, soft shadow. Keep all items and navigation behavior.
5. Keep unread counts and all handlers/routes/state behavior unchanged. Do not change mobile/tablet CSS, markup behavior, or any other pages/components beyond what is needed for the desktop header and its search.

Commit as "Header: clean desktop navigation and search", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the STEP 1 findings, then:
git log --oneline -4
npm run build
npx eslint src/components/SokoNav.jsx src/components/SearchBox.jsx | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Refine the desktop header and search bar so they look professional. Desktop only (min-width 1100px); do not change phone or tablet layouts. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Do not change routes, search logic, auth, fetching or realtime.

STEP 1 - Find the header component (Select-String "Buy. Sell. Find|Post Now|People Looking For" in src). Print raw with line numbers the header markup, search bar, nav row and styles, the unread counts source for chats and notifications, and the account avatar menu. Check that these lucide-react icons exist: ShoppingBag, Store, Target, Wrench, CircleDashed, BadgeCheck, Search, MessageCircle, Bell, Plus, ChevronDown, Clock, X. Fallbacks: CircleDashed -> Clock, BadgeCheck -> ShieldCheck. Then continue.

STEP 2 - Colours/fonts: green #0F9D58, tint #e6f6ed, text #202124, grey #5f6368 / #80868b, border #e8eaed, page #f8f9fa, Sora for the logo, DM Sans elsewhere. Icons: Lucide only, outline, strokeWidth 1.75, no emojis.
1. LAYOUT (1100px+): sticky top, white, z-index above content. Row 1 is 64px: logo at left (remove the tagline "Buy. Sell. Find. Anywhere in Malawi."), a centred search pill (max-width 560px, flex 1), and the actions group at right. Row 2 is the nav, 44px tall. Content max-width 1400px with 24px side padding, same as the page. Total header about 108px.
2. SEARCH: height 44px, radius 999px, background #f1f3f4, no border, 16px Search icon in #5f6368 at the left, placeholder "Search products, services, shops" in #80868b, 15px text. Remove the green "Search" button; Enter submits through the existing handler. A small "/" keyboard hint chip at the right (12px grey, border 1px #e8eaed, radius 6px) that hides on focus; pressing "/" outside an input focuses the search. Focus state: white background, 2px #0F9D58 ring, soft shadow 0 2px 8px rgba(16,24,40,0.08). A clear X button appears when there is text. Keep any existing suggestion dropdown but restyle it: white, 1px #e8eaed border, 14px radius, shadow 0 8px 24px rgba(16,24,40,0.12), 8px below the field, rows 44px with a 16px Clock icon for recent searches, closes on Esc or outside click.
3. ACTIONS (right, 12px gaps): Chats = MessageCircle and Alerts = Bell as 40px icon buttons (22px icon, grey #5f6368, hover background #f1f3f4, radius 10px), icon only with title and aria-label, no text label under them. Unread badges: a red #d93025 dot or count pill (min 18px, 11px white weight 700) at the top right of each icon, using the existing unread counts, hidden at 0. Then the green "Post" button: 40px tall, padding 0 16px, radius 999px, Plus icon 18px plus the text "Post", 14px weight 700, same handler as "Post Now". Then the avatar: 36px circle with a 1px #e8eaed border and a small ChevronDown; click opens the existing account menu restyled with the shared popup menu style (white, 1px border, 14px radius, soft shadow).
4. NAV ROW: items 14px weight 500 grey #5f6368 with a 18px icon on the left and 8px gap, padding 0 14px, height 44px. Icons: Marketplace = ShoppingBag, Shops = Store, People Looking For = Target, Services = Wrench, Statuses (Stories) = CircleDashed, Verification = BadgeCheck. Active item: green #0F9D58 text and icon with a 2px green underline at the bottom; hover: #f6fbf8 background. Keep the same labels and routes. Shorten "Statuses (Stories)" to "Statuses" only if the row would wrap.
5. SCROLL: when the page scrolls more than 8px, add box-shadow 0 1px 0 #e8eaed, 0 4px 12px rgba(16,24,40,0.06) to the header; no shadow at the top.
6. Page content must not jump or hide under the sticky header: set the right top offset for pages that use sticky elements (sidebars, tab rows) so they sit below the new header height.
7. Check at 1100px, 1366px and 1920px that nothing wraps or overlaps. Do not touch the phone and tablet headers.

Commit as "Header: desktop redesign, search pill, consistent icons", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the step 1 findings, then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real header component path> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Fix the title truncation on deal notification rows. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the Notifications page, its row component and their styles. Do not change deal logic, handlers, fetching or other pages.

1. Print raw with line numbers the row's top line, title, time, badge and chevron markup and styles, then fix.
2. Layout of every notification row: avatar 44px (align-self flex-start) on the left; text column (flex 1, min-width 0); right column (flex none, width 56px, align flex-end) containing the time (12px grey, nowrap) and, below it, the 16px chevron. The title is NOT in a flex row with the time or the badge: it sits alone at the top of the text column and may take the full column width.
3. Title: 15px, weight 600, line-height 1.3, max 2 lines, wraps by whole words (word-break normal, overflow-wrap break-word only as a last resort). It must never be cut to a few letters.
4. Move the "Action needed" badge out of the title line. Show it on its own line directly below the body, 11px, weight 700, amber #B06000 on #FFF8E1, radius 999px, padding 2px 8px, margin-top 6px, only when the user must act.
5. Remove the old "Your turn" badge everywhere in Notifications; use "Action needed" in all cases.
6. Apply the plain-copy rewrite to every deal row, so no row shows the old wording: "Offer accepted" / "Wilford James accepted your offer of MWK 30,000 for iphone 2. Confirm to start the deal."; "Ready to confirm this deal" / "You and Wilford James talked it through. Confirm to make it final." Titles are real words, never abbreviated.
7. Body when collapsed: max 2 lines. Expanded panel stays below the top block, indented 56px, as already built.
8. Check at widths 360px, 390px and 1100px that titles show whole.

Commit as "Notifications: full-width deal titles, single badge", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Make deal notifications understandable and expandable, and make deal acceptance clear on every device. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Make edits directly. Edit only the Notifications page, the deal components, the deal card in chat and their styles. Do not change deal logic, handlers, statuses, fetching, realtime or other pages.

STEP 1 - Print raw with line numbers first: the notification row component, NotificationActions, tab row, deal notification types/statuses and generated title/body strings, DealRequestCard, DealConfirmBar, dealNotificationFlow, and where the chat renders media_type === 'deal_request'. Then continue without waiting.

Colours/fonts: green #0F9D58, tint #e6f6ed, amber #B06000 on #FFF8E1, red #D93025 on #FDECEA, grey #5f6368 / #80868b, border #e8eaed, DM Sans.

1. NOTIFICATIONS: deal rows must read as plain deals, not raw database text. Generate clear titles and bodies at render time only. Add an accordion toggle on deal rows that expands to a short "How this works" panel with three numbered steps and a small status badge. Keep the existing row tap, navigation, mark-read, fetching and realtime logic unchanged.
2. NOTIFICATIONS: fix the tab row so all tabs stay reachable by horizontal scrolling on phones and remain inside the centered 720px column on laptop.
3. DEAL CARD / COMPONENTS: show the same simple three-step line ("request sent", "confirm the sale", "vouch for each other") in the chat deal card and in DealRequestCard/DealConfirmBar.
4. DEAL CARD / COMPONENTS: make acceptance clear on every device. DealRequestCard buyer confirmation and DealConfirmBar initiation/confirmation must use a bottom sheet below 769px and a centered sheet above, with 44px touch targets. Keep every existing handler and status unchanged.
5. DEAL CARD / COMPONENTS: replace emoji-led status blocks with clean icons, plain titles, one-line summaries, compact listing rows and inline success/error feedback. Use DM Sans and the colours above.
6. Keep all deal logic, handlers, statuses, fetching, realtime and other pages unchanged.

Commit as "Notifications: expandable rows, plain deal copy; Deal flow: clear steps and confirm sheet", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary: first the STEP 1 findings, then:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
npx eslint <the real Notifications page and deal component paths> --rule "no-use-before-define: [error, { functions: false, classes: false, variables: true }]" ; "TDZ CHECK DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Make the quick-reply chips context-aware and floating. Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only src/pages/Chat.jsx and src/styles/chat-thread.css. Run git status -sb first; if there are uncommitted changes, stop and tell me.

1. Print raw with line numbers the quick-reply row, its chip list and the condition that shows it, then continue.
2. CONTEXT: choose the chip set by chat type (src=request, listing or service) and by who the viewer is.
   - Request chat, viewer is NOT the request owner (a seller replying): "Do you still need it?" (MessageCircleQuestion), "I have it" (PackageCheck), "Send my offer" (HandCoins or BadgeDollarSign; opens the existing offer flow), "Where can we meet?" (MapPin).
   - Request chat, viewer IS the request owner (the buyer): "Please send photos" (Image), "What is your price?" (MessageCircleQuestion), "Is it in good condition?" (PackageCheck).
   - Listing chat, buyer viewing: keep the current chips (Is this still available?, Make an offer, What's your last price?).
   - Service chat: "Are you available?" (CalendarCheck), "What is your price?" (MessageCircleQuestion), "Where are you located?" (MapPin).
   Never show "Is this still available?" in a request chat.
3. Text chips fill and send through the normal send handler. Offer chips open the existing offer flow. Keep the existing show/hide rules (fewer than 3 messages, hidden once the user types).
4. FLOATING STYLE: the row has a transparent background, no border, no shadow, no white bar, padding 0 12px 8px, display flex, gap 8px, overflow-x auto, hidden scrollbar. Each chip is its own pill floating on the chat background: white background, 1px #e8eaed border, box-shadow 0 1px 3px rgba(16,24,40,0.12), 36px tall, padding 0 14px, radius 999px, 14px DM Sans weight 500, flex 0 0 auto, nowrap, 16px Lucide icon on the left in green #0F9D58. Press state: background #e6f6ed. The row sits directly above the composer and never overlaps messages (add matching bottom padding to the message list while it is visible).
5. Do not change sending, offers logic, other chat parts or other pages.

Commit as "Chat view: context-aware floating quick replies", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint src/pages/Chat.jsx | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src

GOAL: Small desktop header polish. Desktop only (min-width 1100px). Branch wip/home-hero-premium (check with git branch --show-current). Rules: no git stash or reset, no SQL, no installs, do NOT launch Chrome or any browser, do not merge or push. Edit only the header component, the early-access banner component and their styles.

1. Early access strip: make it 32px tall (13px text, centred, icon 14px, X 28px target), amber #B06000 on #FFF8E1. On dismiss, store the dismissal in localStorage (try/catch) and stay hidden for 7 days.
2. Avatar chevron: replace the faint circle with a 14px ChevronDown icon in #5f6368 next to the avatar, no circle, visible on hover and focus.
3. Nav label: show "Statuses" instead of "Statuses (Stories)". Keep the route.
4. Hero banner: find why the text and button look faded after load (opacity, transition or overlay). Print the cause raw. The title, subtitle and button must be at full opacity once the slide is active; only the slide change may fade.
5. Do not change anything else.

Commit as "Header: slim early-access strip, chevron, label", append one line to PROGRESS.md and commit it too.

End with RAW output only, no summary:
git log --oneline -4
npm run build
npx eslint <the real changed file paths> | Select-String "no-undef|is not defined" ; "ESLINT DONE"
git status -sb
git diff HEAD~1 --stat -- src
