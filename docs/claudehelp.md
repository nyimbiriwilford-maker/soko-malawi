Improve the mobile emoji picker experience in the SokoMw chat composer.

Current issue:
On mobile view, the emoji picker panel is not displayed properly. Emojis are hidden, clipped, or difficult to select. The user also needs a clear way to dismiss the emoji picker.

Investigate the current emoji picker implementation in src/pages/Chat.jsx and fix the responsive behavior without breaking desktop functionality.

Requirements:

1. Mobile emoji picker layout:
- The emoji picker must be fully visible on mobile screens.
- It must not overflow outside the viewport.
- It must not be hidden behind the keyboard, bottom navigation, or message composer.
- It should adapt properly to different mobile screen sizes.
- Ensure emojis have proper spacing, size, and touch-friendly buttons.
- The emoji grid should scroll internally if there are many emojis.
- Avoid shrinking emojis until they become difficult to tap.

2. Proper dismissal options:
Provide clear ways to close the emoji picker:
- Add a visible close button (X) on mobile.
- Tapping outside the emoji picker closes it.
- Pressing the emoji toggle button again closes it.
- Pressing Escape closes it where supported.
- Do not accidentally close it when selecting emojis.

3. Mobile positioning:
- Position the emoji picker relative to the chat composer.
- Ensure it appears above the input area like modern chat apps (WhatsApp/Telegram style).
- Keep it inside safe screen boundaries.
- Handle mobile keyboard opening correctly.
- Prevent the picker from being pushed off-screen.

4. Touch experience:
- Emoji buttons should have adequate touch size.
- Prevent accidental text selection while scrolling emojis.
- Ensure selecting an emoji:
  - inserts it correctly at cursor position
  - keeps the draft message
  - allows continuing typing immediately.

5. Responsive behavior:
Desktop behavior must remain unchanged.
Use responsive CSS/classes or existing styling approach.
Do not create a separate mobile-only implementation unless necessary.

After completing:
- Explain the root cause of mobile emoji display issues.
- List files changed.
- Explain the responsive solution implemented.
- Verify with npm build.

The final result should feel like a professional mobile chat app where the emoji picker is always visible, usable, and easy to dismiss.