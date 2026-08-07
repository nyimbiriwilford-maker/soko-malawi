Quick fix to emoji picker layout — no investigation needed, small change.

Currently the picker has a separate "recent emojis" strip pinned above the main emoji grid (Chat.jsx ~3921, the recent strip mentioned in prior response.md). This adds fixed height that's wasted space between the picker top and the scrollable grid.

Change: remove the standalone recent-emojis strip, and instead render "Recent" as the FIRST category section inside the same scrollable grid, using the same section-header + tile-grid pattern already used for the other emoji categories (find the existing category rendering loop/pattern in the picker and match it exactly — same header styling, same tile size/grid).

Requirements:
1. Recent emojis (from the existing recentEmojis state/localStorage, same RECENT_EMOJI_LIMIT) become a normal section titled "Recent" prepended before the other category sections, inside the scrollable area — not a separate fixed row above it.
2. If recentEmojis is empty, don't render the Recent section at all (no empty header).
3. Tapping a recent emoji tile calls the same insertEmoji(em) as before — no change to insertion logic.
4. Remove whatever fixed-height container/CSS was reserving space for the old standalone recent strip, so the picker's usable scroll area starts right below the header (ep-header) instead of below header+recent-strip.
5. Do not change picker height (--ep-locked-height), .ep-header, the keyboard-swap button, or any of the mobile-lift changes from previous fixes — only touch the recent-strip → recent-section change.

After implementing, write to docs/response.md:
- Where the old recent strip was removed from (file:line)
- Where the new Recent section was added, confirming it reuses the existing category section pattern (not new one-off styling)
- Confirm insertEmoji tap behavior unchanged
- npx eslint + npm run build results