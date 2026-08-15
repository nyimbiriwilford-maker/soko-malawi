# Strong password enforcement + Confirm Password field

## Request
When creating an account with email and password, add a second field for the user to repeat the password (Confirm Password). Enforce a strong password: at least 8 characters including an uppercase letter, a lowercase letter, a number and a special character. Apply the same when resetting the password.

## Status: implemented
- **`src/utils/validation.js`** — added `validateStrongPassword()` (8+ chars, uppercase + lowercase + digit + special char) and `validatePasswordMatch()` (Confirm vs Password match). New `PASSWORD_STRONG_ERROR` / `PASSWORD_MISMATCH_ERROR` messages.
- **`src/lib/authApi.js`** — `createAccountAfterOtp` and `verifyOtp` (password reset) now enforce the strong-password rule server-side, and `sanitizeAuthError` preserves the full strong-password message.
- **`src/hooks/useAuthFlow.js`** — added `confirmPassword` state; `handleSignUpStart` now validates strong password + match; `handleSetNewPassword` now validates strong password (match already checked). New fields exposed and cleared via `clearSecrets`.
- **`src/pages/LoginPage.jsx`** — Sign Up step now has a **Confirm Password** field (own show/hide toggle) plus a helper note stating the strong-password requirement. The Reset flow's Set New Password step has the same helper note and strong-password enforcement.
- **`src/pages/ResetPassword.jsx`** — standalone Supabase recovery page now enforces the same strong-password rule + confirm match via `validateStrongPassword` / `validatePasswordMatch`.

## Verification
- `npm run build`: PASSES — built in 2.20s, no errors.

## Files changed
- `src/utils/validation.js`
- `src/lib/authApi.js`
- `src/hooks/useAuthFlow.js`
- `src/pages/LoginPage.jsx`
- `src/pages/ResetPassword.jsx`
