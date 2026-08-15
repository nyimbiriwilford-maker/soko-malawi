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
