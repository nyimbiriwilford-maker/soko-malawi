# Strong password enforcement + Confirm Password field

## Request
When creating an account with email and password, add a second field for the user to repeat the password (Confirm Password). Enforce a strong password: at least 8 characters including an uppercase letter, a lowercase letter, a number and a special character. Apply the same when resetting the password.

## Status: implemented
- **`src/utils/validation.js`** — added `validateStrongPassword()` (8+ chars, uppercase + lowercase + digit + special char) and `validatePasswordMatch()` (Confirm vs Password match). New `PASSWORD_STRONG_ERROR` / `PASSWORD_MISMATCH_ERROR` messages.
- **`src/lib/authApi.js`** — `createAccountAfterOtp` and `verifyOtp` (password reset) now enforce the strong-password rule server-side, and `sanitizeAuthError` preserves the full strong-password message.
- **`src/hooks/useAuthFlow.js`** — added `confirmPassword` state; `handleSignUpStart` now validates strong password + match; `handleSetNewPassword` now validates strong password (match already checked). New fields exposed and cleared via `clearSecrets`.
- **`src/pages/LoginPage.jsx`** — Sign Up step now has a **Confirm Password** field (own show/hide toggle) plus a helper note stating the strong-password requirement. The Reset flow's Set New Password step has the same helper note and strong-password enforcement.
- **`src/pages/ResetPassword.jsx`** — standalone Supabase recovery page now enforces the same strong-password rule + confirm match via `validateStrongPassword` / `validatePasswordMatch`.

## Real-time password strength meter (new)
- **`src/utils/validation.js`** — added `getPasswordStrength(value)` returning a 0–4 score, a label (Weak / Fair / Good / Strong) and per-criterion met flags (length, uppercase, lowercase, number, special) for live feedback.
- **`src/components/auth/PasswordStrength.jsx`** (new) — animated meter component: a labelled progress bar plus a checklist that ticks each requirement as it's met. Shown as the user types (hidden until the password has content).
- Wired into **`src/pages/LoginPage.jsx`** (Sign Up + Set New Password steps) and **`src/pages/ResetPassword.jsx`**, replacing the previous static hint paragraph.

## Verification
- `npm run build`: PASSES — built in 2.12s, no errors.

## Files changed
- `src/utils/validation.js`
- `src/lib/authApi.js`
- `src/hooks/useAuthFlow.js`
- `src/pages/LoginPage.jsx`
- `src/pages/ResetPassword.jsx`
- `src/components/auth/PasswordStrength.jsx` (new)
- `src/components/auth/index.js`

## Remove username field from OTP verification page (new)
- **`src/pages/LoginPage.jsx`** — the "Verify Email" step (where users enter the emailed 6-digit code) no longer asks for a username. Removed the field and updated the subtitle text.
- **`src/hooks/useAuthFlow.js`** — removed `username`/`setUsername` state and `usernameRef`; the username is now auto-derived from the email in `handleVerifyAndCreate`.
- **`src/utils/validation.js`** — added `deriveUsernameFromEmail(email)` which sanitizes the email local-part into a valid username (3-20 chars, letters/digits/./_). Profile creation and the verify-otp edge function still receive a username.

## Live red border on Confirm Password mismatch (new)
- **`src/pages/LoginPage.jsx`** — the Confirm Password fields in both the Sign Up step and the Set New Password (reset) step now show the error state live: as soon as the typed value differs from the password, the field turns red (error styling via existing `.login-field.is-error`) with a "Passwords do not match." message, without waiting for blur or submit. It returns to valid styling once the two match.

## Continue button gated on Terms + deny already-registered emails (new)
- **`src/pages/LoginPage.jsx`** — the "Continue" button on the Sign Up step is now disabled until the Terms & Privacy checkbox is checked (`disabled={busy || !agreedToTerms}`).
- **`src/lib/authApi.js`** — `sendOtp` now accepts an `action` ('signup' | 'reset') and forwards it to the `send-otp` edge function.
- **`src/hooks/useAuthFlow.js`** — passes `'signup'` on the signup/resend-signup OTP sends and `'reset'` on the forgot-password/resend-reset sends.
- **`supabase/functions/send-otp/index.ts`** — when the OTP is for **signup** (email), the function now checks `profiles` by email and returns HTTP 409 "This email is already registered. Please sign in instead." so already-registered users are denied before any code is sent. Reset requests are unaffected.

## Clear "already registered" message (new fix)
The user reported seeing the generic "Something went wrong. Please try again." instead of a clear message. Fixed at three layers so a clear message always surfaces:
- **`src/lib/authApi.js`** — `sanitizeAuthError` now maps "already registered / already have an account / user already / already exists" to **"An account already exists with this email. Please sign in instead."** Also added a client-side pre-check in `sendOtp` (profiles is anon-readable) that rejects registered emails before calling the edge function — so it works even if the edge function is stale.
- **`supabase/functions/send-otp/index.ts`** — the server check now also verifies the authoritative `auth.users` table (paging through `admin.listUsers`) in case a user exists without a profile row, and returns HTTP 409 with the clear message.

## Continue button visibly inactive until terms ticked (new)
- **`src/pages/LoginPage.jsx`** — the Sign Up Continue button was already gated on `!agreedToTerms` (so it can't be clicked before the Terms & Privacy checkbox is checked).
- **`src/styles/login.css`** — strengthened the disabled styling so the gate is visually obvious: `.login-btn:disabled` now fades the button (opacity 0.45, desaturated) and removes the lift/box-shadow, with `not-allowed` cursor. Before, only the cursor changed so the button looked clickable.

## Login email detection + "Continue as" confirm (new)
- **`src/pages/LoginPage.jsx`** — the login form is now two-step:
  1. **Email step**: as the user types, `validateEmail` detects when the email is valid. A confirmation card appears showing an avatar initial and "Continue as {Name}?" (name derived from the email local-part) plus the email itself.
  2. **Confirm step**: the Continue button stays disabled until a valid email is detected; clicking it (or pressing enter) confirms the identity, reveals the Password field, Remember Me + Forgot Password row, and switches the button to "Sign In". Changing the email resets the confirmation.
- **`src/styles/login.css`** — added `.login-email-confirm` card styles (avatar, title, subtitle, fade-up animation).

## Google One Tap — detect device Google account + "Continue as {email}" (new)
- **`src/components/auth/GoogleOneTap.jsx`** (new) — loads Google Identity Services, initializes with the web client id, and calls `google.accounts.id.prompt()`. If a Google account is already signed in on this device/browser, Google renders the native **"Continue as {email}"** prompt automatically. The returned ID token is exchanged for a Supabase session via `signInWithIdToken` — no redirect.
- **`src/lib/authApi.js`** — added `signInWithGoogleIdToken(idToken)` using `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
- **`src/hooks/useAuthFlow.js`** — added `handleGoogleOneTap` handler (exchanges the token, navigates to `/` on success, surfaces errors).
- **`src/pages/LoginPage.jsx`** — renders `<GoogleOneTap>` on the LOGIN mode with `VITE_GOOGLE_CLIENT_ID` from env. Falls back silently to the existing "Continue with Google" button when no client id is configured or no account is detected.
- **`src/components/auth/index.js`** — exported the new component.
- **`.env`** — added a commented `VITE_GOOGLE_CLIENT_ID` placeholder (git-ignored).

> Requires setup: create a **web application** OAuth client in Google Cloud Console, add the app origin to its authorized JavaScript origins, and set `VITE_GOOGLE_CLIENT_ID` in the Vercel project env. Until then the existing Google button keeps working and One Tap simply stays silent.

## One Tap not auto-detecting? (diagnostics added)
- Added console logging to `GoogleOneTap.jsx` so the reason is visible in the browser devtools (`[OneTap] ...` messages + the full prompt notification, including `getNotDisplayedReason()`).
- Most common causes for no auto-detect:
  1. **Vite bakes `VITE_*` vars at build time** — adding `VITE_GOOGLE_CLIENT_ID` in Vercel alone does nothing until the app is **redeployed** (push a new commit or use Vercel "Redeploy"). Check the running bundle's console for `[OneTap] VITE_GOOGLE_CLIENT_ID is not set`.
  2. **Authorized JavaScript origins** in Google Cloud Console must include the deployed origin exactly (e.g. `https://soko-malawi.vercel.app`) — otherwise the prompt is silently suppressed (`unregistered_origin`).
  3. **User must be signed into Google** in that browser/device — otherwise the reason is `opt_out_or_no_session` and no prompt appears.
  4. **Supabase Google provider client id** must match — `signInWithIdToken` validates the token audience against the client id configured for Google in Supabase Auth. If they differ, the token exchange fails even though the prompt shows.

## Bottom nav climbs over on-screen keyboard when typing in Chat search (new)
The mobile bottom nav (.sbn-bar) is position: fixed at the bottom, so opening the keyboard while focused in the Chats search box made the nav float on top of the keyboard. Fixed globally:
- **`src/App.jsx`** — added a `visualViewport` listener (plus window resize) that toggles a `keyboard-open` class on `document.body` when the on-screen keyboard shrinks the visual viewport (detects iOS + Android overlay and resize modes; re-baselines when the keyboard closes).
- **`src/components/BottomNav.jsx`** — when `body.keyboard-open` is set, the bottom nav bar (and the inner bar) slide down off-screen (translateY(115%), opacity 0, pointer-events none) with a 0.25s transition, then slide back when the keyboard closes. Desktop is unaffected (visualViewport == innerHeight there).
## Verification
- `npx eslint` on the two touched files: only 3 pre-existing errors in App.jsx (lines 131/140/141, the original getSession effect) — none from this change.
- `npx vite build`: PASSES (2.17s).
## Files changed
- `src/App.jsx`
- `src/components/BottomNav.jsx`

## Long-press reveals star & archive buttons on chat list rows (new)
The star and archive icons were previously always visible on every chat row. Now they only appear when a row is long-pressed:
- **`src/pages/ChatListPanel.jsx`**
  - Added `revealedKey` state plus `longPressRef` / `suppressClickRef` refs.
  - `startLongPress` / `moveLongPress` / `cancelLongPress` — touch (touchstart/move/end/cancel) and mouse (mousedown/move/up/leave) long-press detection: fires after ~480ms of holding still; cancels if the pointer moves >10px (so scrolling never triggers it). Right-click (`onContextMenu`) also reveals as a desktop fallback.
  - Row `onClick` suppresses the click that immediately follows a long-press, and a tap anywhere else dismisses the reveal before navigating.
  - Star/archive buttons now render only when `revealedKey === chat.key`, animating in via a new `revealIn` keyframe. The ⋮ options button stays always visible.
  - Scroll of the chat list dismisses an open reveal.
  - `.chat-row` CSS now sets `-webkit-touch-callout: none; user-select: none; touch-action: pan-y` so long-press doesn't trigger iOS text selection / callouts or interfere with vertical scrolling.
## Verification
- `npx eslint src/pages/ChatListPanel.jsx`: only pre-existing errors; none from this change.
- `npx vite build`: PASSES.
## Files changed
- `src/pages/ChatListPanel.jsx`

## Chat list: search icon at top, search box appears only when tapped (new)
- **`src/pages/ChatListPanel.jsx`**
  - Added `searchOpen` state. A search icon button (`SearchGlassIcon`) now sits at the top of the panel in the brand row, next to the ⋮ filters button (wrapped in a new `brandActions` row; the button shows a green active state via new `menuBtnActive` style while open).
  - The search box is no longer always visible — it renders only when `searchOpen` is true, dropping in with a new `searchDrop` keyframe and auto-focusing. It keeps the existing query-clear button and adds a close (X) button (`S.searchCloseBtn`) that collapses the search. Tapping the search icon again toggles it back.
## Verification
- `npx eslint src/pages/ChatListPanel.jsx`: no new errors from this change.
- `npx vite build`: PASSES.
## Files changed
- `src/pages/ChatListPanel.jsx`

## Long-press now selects chats; star/archive/delete live in a selection bar (new)
Changed long-press from revealing inline icons to full multi-select mode (WhatsApp-style):
- **`src/pages/ChatListPanel.jsx`**
  - `revealedKey` replaced with `selectedKeys` (Set). Long-press (or right-click) now selects that chat and enters selection mode; a selected row gets a green check badge on its avatar and a highlighted background.
  - While selecting, tapping rows toggles their selection instead of navigating; the per-row ⋮ button is hidden; the list scrolls without cancelling the selection.
  - The brand row is replaced by a **selection bar** showing the count plus three actions: Star / Unstar, Archive / Unarchive (applied to all selected), and Delete (confirm → `markChatDeleted` for each). Bulk star/archive decide all-vs-none from the current selection; archive/delete exit selection.
  - Selection clears on confirm via the bar close button; navigating into a thread is impossible while selecting (row taps toggle), and leaving /chats unmounts the panel so state resets.
  - Removed the now-unused `toggleStar` / `toggleArchive` per-row helpers and `revealIn` keyframe.
## Verification
- `npx eslint src/pages/ChatListPanel.jsx`: 11 errors, all pre-existing (was 12 before this change).
- `npx vite build`: PASSES.
## Files changed
- `src/pages/ChatListPanel.jsx`

## Swipe-to-dismiss / reply on popup notifications (messages only) (new)
Popup notification toasts (`NotificationToast.jsx`) now support touch swipes, and the swipe gestures apply **only to `new_message` (message) notifications**:
- **Swipe left** → **dismiss** the toast (slides off to the left, then fades away). Uses `dismiss({ keepOffset: true })` so the slide-out offset survives the fade instead of snapping back.
- **Swipe right** → **quick reply** (expands the inline reply input on message toasts).
- Non-message toasts ignore swipe gestures entirely (tap still navigates to /notifications).
- Swipes on the reply area are ignored (so typing / tapping the input never triggers a swipe).
- After a swipe, the trailing click event is suppressed so it doesn't also navigate to /notifications.
- Horizontal-only movement is required (a vertical scroll/pan never triggers a swipe); dragging disables the CSS transform transition so the toast follows the finger live (`touch-action: pan-y` kept).
## Implementation details
- `dragRef` / `swipedRef` refs track the pointer; `swipeX` / `dragging` state drive the live translate + transition toggling.
- `handleTouchStart` bails out when `!isMessage` — this is the guard that confines swipe gestures to message toasts only.
- `endSwipe` uses a 70px threshold; right = reply (settles back to 0 and opens the reply input), left = slide-out dismiss.
## Verification
- `npx eslint src/components/NotificationToast.jsx`: 2 errors, both pre-existing (line 116 empty catch, line 201 setState-in-effect) — none from this change.
- `npx vite build`: PASSES.
## Files changed
- `src/components/NotificationToast.jsx`

## Fix: desktop header missing on wide screens (new)
The desktop top navigation (brand + search + Chats/Alerts + Post Now + avatar) and the desktop pillar row were invisible on all screen sizes, including desktop.
- **Root cause** — in `SokoNav.jsx` the inline `<style>` block had two rules placed **after** the `@media (max-width: 360px)` block's closing brace (followed by a stray `}`):
  ```css
  .soko-nav-desktop { display: none !important; }
  .soko-pillar-row { display: none !important; }
  ```
  Because they were outside any media query, `display: none !important` applied at **every** width, so the desktop nav never rendered on wide screens.
- **Fix** — moved `.soko-nav-desktop` and `.soko-pillar-row` hide rules **inside** the `@media (max-width: 768px)` block (alongside the existing mobile-only rules) and removed the stray brace. Now they only hide on mobile, so ≥769px viewports show the full desktop header + pillar row again.
## Verification
- `npx vite build`: PASSES.
## Files changed
- `src/components/SokoNav.jsx`

## Remove "Calls" category from Notifications (new)
The **Calls** category is no longer visible in the Notifications UI — removed from both the header tab bar (`TABS`) and the filter panel category list (`CATEGORIES`).
- `TABS` no longer includes the `calls` tab (Phone icon), so the header shows All / Messages / Listings / Offers / Deals / Orders / System.
- `CATEGORIES` no longer includes `calls`, so the advanced Filters → Category section omits it too.
- Missed-call notifications themselves still render in the All list (unchanged behaviour) — only the category filter/tab is hidden. The `Phone` import is kept because it's still used by the "Call back" action button.
## Verification
- `npx eslint src/pages/Notifications.jsx`: 9 errors, all pre-existing (setState-in-effect, refs-in-render, memoization) — none from this change.
- `npx vite build`: PASSES.
## Files changed
- `src/pages/Notifications.jsx`

## Move status posting to the Post button (home + nav) (new)
The home page's **first status card** ("Create Status" — the `AddStatusCard` "Create/Sell Products/Promote Business/Share Updates" card at the start of the status rail) has been **removed**. Posting a status is now done from the **Post** buttons:
- **Mobile** — the bottom nav Post (FAB) menu now includes a **Status** item ("Share a quick update") that navigates to `/status?compose=1`.
- **Desktop** — the header **Post Now** menu now includes a **Status** item ("Share a quick update") that navigates to `/status?compose=1`.
- The status rail header's old desktop-only "Post status" button was removed too (superseded by the header Post menu).
- `StatusPage` auto-opens the `StatusUploadModal` when arriving with `?compose=1` (the query param is stripped afterwards so refresh/re-entries don't re-open it).
## Implementation details
- `HomeStatusSection.jsx`: removed `AddStatusCard` component + its render + the desktop "Post status" header button; dropped now-unused `Plus` import and `currentUserProfile` prop.
- `BottomNav.jsx`: added `Sparkles` import, Status menu item, and `.sbn-post-ic-status` styling.
- `SokoNav.jsx`: added `Sparkles` import and the Status entry in `POST_ITEMS`.
- `StatusPage.jsx`: added `useEffect` that opens the upload modal when `compose=1` is in the query string.
## Verification
- `npx vite build`: PASSES.
## Files changed
- `src/components/HomeStatusSection.jsx`
- `src/components/BottomNav.jsx`
- `src/components/SokoNav.jsx`
- `src/pages/StatusPage.jsx`

## Animated Status option in post menus (new)
The **Status** item in both the mobile bottom-nav post menu and the desktop header **Post Now** menu is now visually distinct with story/status-themed animations:
- **Rotating story ring** — the Status icon sits inside a `conic-gradient` ring (green → gold → green, with a red accent) that continuously spins (`sbnRingSpin` / `sokoRingSpin`), like an Instagram/WhatsApp status ring.
- **Pulsing glow** — the ring's box-shadow pulses (`sbnRingPulse` / `sokoRingPulse`) to draw attention.
- **LIVE badge** — a small red `LIVE` pill next to "Status" blinks on/off (`sbnLiveBlink` / `sokoLiveBlink`).
- **Shimmer sweep** — the mobile status row has an animated light sweep (`sbnShimmer`) across its subtle green/gold gradient background (mobile only).
- The menu row gets a soft green→gold gradient background, a tinted border, and the chevron turns green — so it clearly stands apart from Listing / Looking For / Service.
## Implementation details
- `BottomNav.jsx`: added `sbn-status-ring` wrapper + `LIVE` pill + `.sbn-post-item-status` styling and the `sbnRingSpin / sbnRingPulse / sbnShimmer / sbnLiveBlink` keyframes.
- `SokoNav.jsx`: `POST_ITEMS` Status entry now has `status: true`; the render switches to an animated ring + LIVE badge, and the shared nav `<style>` block carries `sokoRingSpin / sokoRingPulse / sokoLiveBlink` + the tinted `.is-status` row styling.
## Verification
- `npx vite build`: PASSES.
## Files changed
- `src/components/BottomNav.jsx`
- `src/components/SokoNav.jsx`

## Fix: bottom-nav post popup sizing / top-header overlap (new)
The mobile bottom-nav **post popup** (`.sbn-post-menu`) could grow taller than the visible area and slide under the sticky top header on small screens.
- Added `max-height: calc(100dvh - 210px)` so the popup is capped at the space between the sticky mobile header (~110px) and the bottom nav (84px + safe-area inset). It can never extend behind the top header.
- Added `overflow-y: auto` + `-webkit-overflow-scrolling: touch` + `overscroll-behavior: contain` so on very short screens the menu scrolls instead of overflowing.
- Added `max-width: calc(100vw - 24px)` and a thin scrollbar style; `min-height: 0` keeps flex/intrinsic sizing from fighting the cap.
## Files changed
- `src/components/BottomNav.jsx`

## Fix: adaptive popup sizing so nothing is hidden on short phones (revision)
The bottom-nav post popup was still too tall on short phones and got clipped under the sticky top header. Two fixes:
1. **vh fallback** — the `max-height` cap now starts with `calc(100vh - 210px)` (supported everywhere) and only overrides with `100dvh` where supported. Previously only `100dvh` was used, which some phone browsers ignore entirely — that is why the earlier fix appeared to do nothing.
2. **Adaptive compaction** — two `@media (max-height: …)` breakpoints shrink the option rows, icons, ring, and typography so the *whole* menu fits on screen without scrolling:
   - `@media (max-height: 660px)` → compact: menu padding/head reduced, icon + ring 42→34px, row padding 11→7px, fonts ~0.82/0.68rem, menu sits a bit lower (`bottom: 70px`).
   - `@media (max-height: 560px)` → extra compact: icon + ring 34→30px, row padding 5px, fonts ~0.78/0.65rem, menu at `bottom: 64px`.
   - The `sbn-post-ic svg` / `sbn-status-ring svg` sizes are also scaled so the glyphs shrink with the rows.
The popup remains `position: fixed` bottom-anchored with `overflow-y: auto` as a final safety net, and `max-width: calc(100vw - 24px)` keeps it within the screen width.
## Files changed
- `src/components/BottomNav.jsx`

## Consistent Status icon (revision)
The Status post-menu icon now matches the mobile top-nav **Statuses (Stories)** icon for consistency.
- The mobile top-nav "Statuses (Stories)" pillar (`SOKO_PILLARS` in `SokoNav.jsx`) uses the **clock** glyph (circle + clock hands).
- Swapped the post-menu Status icon from `GalleryHorizontalEnd` to **`Clock`** in both `BottomNav.jsx` (mobile post menu) and `SokoNav.jsx` (`POST_ITEMS` desktop menu), at the same stroke weight (1.75) so the two match.
## Files changed
- `src/components/BottomNav.jsx`
- `src/components/SokoNav.jsx`

## Refined professional Status option (revision)
The previous flashy treatment (spinning conic ring, pulsing glow, blinking red LIVE badge, shimmer sweep) was replaced with a calm, professional design:
- **Smooth icon** — swapped `Sparkles` for the cleaner `GalleryHorizontalEnd` (gallery/story glyph) at a lighter stroke weight (1.75).
- **Static gradient ring** — the icon sits in a refined circular ring using a single green gradient (`#0F9D58 → #22a05e → #0a7a44`) with a soft 2px shadow. No spin, no pulse.
- **Subtle tinted row** — the Status row keeps a faint green/gold wash background and a thin green border so it still reads as "featured", with a gentle hover shadow. The label turns deep green.
- **Removed** all gimmicky animations: `sbnRingSpin`, `sbnRingPulse`, `sbnShimmer`, `sbnLiveBlink`, `sokoRingSpin`, `sokoRingPulse`, `sokoLiveBlink` and the `LIVE` badge.
## Implementation details
- `BottomNav.jsx`: updated the Status item JSX (new icon, no LIVE pill), replaced the status CSS with the subtle ring/tint, removed unused keyframes and `Sparkles` import.
- `SokoNav.jsx`: updated `POST_ITEMS` Status icon + `status: true` render path, removed the animated ring/LIVE badge inline styles and unused keyframes/import.
## Verification
- `npx vite build`: PASSES.
## Files changed
- `src/components/BottomNav.jsx`
- `src/components/SokoNav.jsx`
