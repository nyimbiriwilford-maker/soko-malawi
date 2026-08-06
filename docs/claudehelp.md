Improve the SokoMw chat emoji picker by adding a "Recently Used Emojis" memory feature while preserving the existing emoji picker architecture.

Scope:
- Keep changes focused on the existing chat composer emoji system.
- Do not break current emoji insertion, cursor handling, mobile layout, or desktop behavior.

Feature:
Add a persistent memory of the user's recently used emojis.

Requirements:

1. Recent emoji tracking:
- Every time a user selects an emoji, record it as recently used.
- Store the most recent emojis in order.
- Avoid duplicates:
  - If an emoji is selected again, move it to the front instead of creating a duplicate.
- Keep a reasonable limit (for example 20-30 emojis).
- Preserve the existing emoji insertion flow.

2. Storage:
- Use localStorage for persistence.
- Recent emojis should remain available after:
  - refreshing the page
  - closing and reopening the browser
  - returning to the chat later
- Use a dedicated storage key (example: soko_recent_emojis).
- Handle invalid or corrupted localStorage data safely.

3. Emoji picker UI:
- Add a "Recent" section/tab at the beginning of the emoji categories.
- Show recently used emojis first when available.
- If the user has no history yet:
  - show a clean empty state
  - fall back to the default emoji category.
- Keep the current category system working.

4. Mobile experience:
- Recent emojis should use the same touch-friendly sizing already implemented.
- Ensure the recent section does not break the mobile scroll behavior.
- Keep the picker height stable.
- Maintain the close button and existing dismissal behavior.

5. Performance:
- Do not write to localStorage on every render.
- Only update storage when an emoji is selected.
- Use state/ref appropriately to avoid unnecessary re-renders.
- Do not affect typing performance.

6. UX behavior:
Example flow:

User opens emoji picker
↓
Recent tab appears first
↓
User sees their commonly used emojis
↓
User taps emoji
↓
Emoji inserts at cursor position
↓
Emoji moves to front of recent list
↓
User continues typing immediately

7. Verification:
After implementation:
- Explain the root cause/approach.
- List files changed.
- Confirm mobile and desktop behavior.
- Confirm localStorage persistence works.
- Run npm build.

The final experience should feel similar to WhatsApp, Telegram, or Messenger where users quickly access emojis they frequently use.