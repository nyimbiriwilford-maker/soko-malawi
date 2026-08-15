# Terms & Conditions + Privacy Policy on the login page

## Request (from docs/claudehelp.dm)
Do research on what can be all terms and conditions of this app that a user can agree to first on login before creating an account. On the login page, write those terms for users to agree.

## Research
- Audited the app's full feature set to draft accurate legal text: marketplace listings, shops, jobs, services, Looking For requests, statuses/stories, chats + audio/video calls, deal confirmation + vouching/trust scores, seller verification, featured listings (MWK 2,500 / 7 days), OTP email verification, Cloudflare Turnstile captcha, admin role.
- Malawi Data Protection Act, 2024 (in force 3 June 2024; MACRA is the data protection authority): lawful processing, data-subject rights (access/rectify/delete/restrict/port), 72-hour breach notification to MACRA and affected users, safeguards for international transfers, no data from children.

## Status: implemented
- **`src/constants/legal.js`** — new: full Terms & Conditions (20 sections: acceptance, eligibility 18+, account security, platform use, user content, prohibited content, transactions between users, fees & paid features, verification/vouching/trust, chats & calls, IP, privacy, warranties, liability, indemnity, suspension, disputes/governing law, changes, general, contact) plus a Privacy Policy (12 sections aligned with the Malawi Data Protection Act 2024). Written in plain, consumer-friendly language specific to SokoMw's features.
- **`src/components/auth/TermsModal.jsx`** — new: polished bottom-sheet modal branded with the SokoMw logo (green "Soko" + amber "Mw" wordmark with the Sora display font and house badge). Clean, orderly, mobile-friendly: handle bar, brand header row, title block, Terms/Privacy tab switcher, scrollable content with a highlighted intro callout, and a scroll-to-read gate (the "I Agree" button stays disabled until the user scrolls to the end). Safe-area padding, touch scrolling, focus management and reduced-motion friendly.
- **`src/pages/LoginPage.jsx`** — the existing "I agree" checkbox on the Sign Up step is now a clickable inline link to "Terms & Conditions" and "Privacy Policy" that opens the TermsModal. Clicking "I Agree" in the modal also ticks the checkbox automatically; the existing agreement check in `useAuthFlow` (which blocks sign-up until the box is ticked) still applies.
- Exported `TermsModal` from `src/components/auth/index.js`.

## Verification
- `npm run build`: PASSES — built in 2.11s, no errors.

## Files changed
- `src/constants/legal.js` (new)
- `src/components/auth/TermsModal.jsx` (new)
- `src/components/auth/index.js`
- `src/pages/LoginPage.jsx`
