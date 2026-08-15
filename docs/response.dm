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
