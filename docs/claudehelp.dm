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
