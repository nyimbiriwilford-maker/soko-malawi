Implement Recent as a real first-class tab in the emoji picker. Reference: docs/response.md investigation.

1. In emojiCatalog.js: add a 'recent' category entry to EMOJI_CATEGORIES as the FIRST item in the array — same shape as other entries: { id: 'recent', label: 'Recent', icon: <clock emoji, e.g. '\u{1F551}'>, emojis: [] } (emojis stays empty here; real content is injected dynamically in Chat.jsx, not stored statically).

2. Change DEFAULT_EMOJI_TAB to resolve to 'recent' (EMOJI_CATEGORIES[0].id will now naturally be 'recent' given step 1, so this may need no separate change — confirm and adjust only if DEFAULT_EMOJI_TAB is hardcoded elsewhere instead of derived from EMOJI_CATEGORIES[0]).

3. In Chat.jsx, replace the current unconditional Recent-section-at-top-of-grid code (Chat.jsx:3919-3926, the `{recentEmojis.length > 0 && (...)}` block that currently renders regardless of emojiTab) with tab-gated logic:
   - Remove that unconditional block entirely from its current position.
   - In the grid-rendering logic (currently `EMOJI_BY_ID[emojiTab]?.emojis`), add a branch: when emojiTab === 'recent', the tile source is `recentEmojis.length > 0 ? recentEmojis : EMOJI_FREQUENT` (import EMOJI_FREQUENT from emojiCatalog.js). Otherwise (any other tab), tile source stays `EMOJI_BY_ID[emojiTab]?.emojis || []` exactly as before.
   - Recent emojis must ONLY appear when emojiTab === 'recent' — do not also show them prepended on other tabs anymore.
   - Tiles keep using the same .ep-btn class and insertEmoji(em) handler, no change to insertion logic.

4. Confirm the 'recent' tab renders in .ep-tabs like every other tab (same button markup, same active-state styling) — it should look and behave identically to Smileys/Hearts/etc., just first in order with a clock icon.

5. "Prioritize recent once used" requirement: when recentEmojis is non-empty, the Recent tab shows actual recent picks (existing insertEmoji logic already prepends newest-used first — confirm this ordering is preserved, most-recently-used emoji appears first in the Recent tab grid).

6. Empty state: when recentEmojis is empty (new user / cleared storage) AND user opens the picker (which defaults to the 'recent' tab per step 2), the grid should show EMOJI_FREQUENT (common/frequently-used defaults) rather than a blank grid. Once the user starts using emojis, insertEmoji already populates recentEmojis via existing logic — next time they open the picker (still defaulting to 'recent' tab), it should show their real recents instead of the static EMOJI_FREQUENT list. Confirm this switchover happens automatically via the existing recentEmojis.length > 0 ? recentEmojis : EMOJI_FREQUENT branch — no extra state needed.

7. Do not touch --ep-locked-height, .ep-header, keyboard-swap button, mobile-lift fixes, or any other category's static emojis array.

After implementing, write to docs/response.md:
- Confirm EMOJI_CATEGORIES[0] is now 'recent' and DEFAULT_EMOJI_TAB resolves correctly
- Confirm the old unconditional recent-section code is fully removed (not just bypassed)
- Confirm recent emojis appear ONLY on the recent tab, nowhere else
- Confirm empty-state fallback to EMOJI_FREQUENT works and switches to real recents after first use
- npx eslint + npm run build results