
# Facebook login removal — applied

## Request
Apply all 6 changes from the Facebook login removal checklist, then run `npm run build` and confirm it passes.

## Changes (all applied)
1. `src/pages/LoginPage.jsx` — deleted the facebook `<SocialButton provider="facebook" ... />` block (was lines 61-66). Google button remains.
2. `src/components/auth/SocialButton.jsx` — deleted the `FacebookIcon` function (was lines 14-23).
3. `src/components/auth/SocialButton.jsx` — deleted the `facebook` entry from `PROVIDERS` (was line 27). `PROVIDERS` now contains only `google`.
4. `src/lib/authApi.js:15` — `const ALLOWED_OAUTH_PROVIDERS = new Set(['google']);`
5. `src/hooks/useAuthFlow.js:213` — now `if (provider !== 'google') {`
6. `src/hooks/useLoginForm.js` — file deleted (was dead code, not imported anywhere).

## Notes
- `SocialButton` import in `LoginPage.jsx` kept — still used by the Google button.
- `SocialButton.jsx:38` fallback `PROVIDERS[provider] || PROVIDERS.google` and the default `provider = 'google'` prop mean the component works unchanged with only the google config.
- Unrelated Facebook references (shop social_facebook link in ShopPage.jsx, share buttons in ListingDetail.jsx, `FBListingCard` in SearchPage.jsx) left untouched per scope.

## Verification
- `npm run build`: PASSES — vite built 2107 modules, production bundle in 3.79s, no errors.
