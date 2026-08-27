TASK: Hide the "Create Status" card on home page statuses section on landing/refresh so only posted status cards are visible; reveal it on scroll, or keep it visible when 0-1 posters (mobile fills its two visible card slots).

DONE in src/components/HomeStatusSection.jsx:

1. Flicker-free hide on landing/refresh
   - Removed the old setTimeout(100ms) auto-scroll effect (which visibly flashed the create card before jumping).
   - Added a useLayoutEffect (runs before paint) that measures the create card's real width + rail gap from the DOM and sets the rail's scrollLeft past it. So on landing/refresh the user sees posted status cards only — no flash of the create card.

2. Visibility rules (cards are grouped per person, so counts are per poster):
   - 2+ posters: create card is off-screen at position 0. Scroll/swipe left to reveal it. New statuses arriving while scrolled do NOT yank scroll position back.
   - Exactly 1 poster: rail starts at position 0 showing Create Status card first, the posted status second — fills mobile's two visible card slots.
   - 0 posters: the create card is shown in the rail (previously a text-only empty state was shown instead). The "No X stories right now" empty message is kept only for non-All category filters.

3. Header: "View All" button is now hidden when there are no statuses (it was a no-op before).

VERIFIED:
- npx eslint src/components/HomeStatusSection.jsx — clean (0 errors, 0 warnings).
- npm run build — built successfully (4.43s).

────────────────────────────────────────────────────────────

TASK: Status page — remove distance from the status feed card; add Soko Reels generated from the most-viewed status videos, placed randomly inside the status feed; tapping the reels card plays the current top status videos in a professional, SokoMw-themed reels viewer.

DONE:

1. Distance removed — src/pages/StatusPage.jsx
   - StatusFeedCard no longer shows "X km away". Location text, time, views and expiry stay unchanged. Distance is still used internally for feed ordering (nearby first) — only the label was removed.

2. Reels data — src/hooks/useReels.js (new)
   - Filters live statuses down to video posts, ranks by status_views count (ties: newest first), top 12.
   - Tracks views + likes (with your own like state) and refreshes live via Supabase realtime on new views/reactions.
   - registerView() records a view in status_views once per session per reel (same upsert pattern as StoryViewer), so watching reels feeds back into the "most viewed" ranking.

3. In-feed reel card — src/components/StatusReels.jsx (new: ReelFeedCard)
   - Professional SokoMw-styled card: green gradient play icon, "Soko Reels" title, orange Trending pill, total views pill.
   - Shows the top 3 hottest video thumbnails (#1/#2/#3 rank chips, author + views per thumb) and a "Watch reels · N videos" CTA.
   - Placed at random-feeling spots in the status feed: positions are seeded by the viewer's user id (same personalisation as the feed shuffle), one card mid-feed and a second one deeper for longer feeds — stable across a session's refreshes, different per person.

4. Reels viewer — src/components/StatusReels.jsx (ReelsViewer)
   - Full-screen dark vertical swiper (TikTok/IG style): scroll-snap, one reel per screen, only the visible reel plays.
   - Auto-advances to the next reel when a video ends; tap to pause/resume with pause overlay; green progress bar; mute/unmute control.
   - Handles trimmed clips (#t= media fragments) correctly for seek, progress and loop; the last reel loops.
   - Right action rail: Like (live counts, persisted to status_reactions), Comments (opens the shared StatusCommentsPanel bottom sheet — same commenting behaviour as stories/feed), Share (native share on mobile, copy link otherwise).
   - Author block: avatar, name, verified badge, Reel badge, time, location, views, caption.
   - Top bar: close button, "Soko Reels" title, position counter. Records a view per watched reel.

VERIFIED:
- npx eslint on StatusReels.jsx / useReels.js / StatusPage.jsx — 0 errors (only 3 pre-existing exhaustive-deps warnings on unstable-function deps, unchanged from before).
- npm run build — built successfully (4.95s).
