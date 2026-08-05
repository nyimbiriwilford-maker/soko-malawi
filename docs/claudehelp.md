Apply this exact restoration to src/pages/Chat.jsx. Do not touch anything else in the file — this only re-adds code that existed at commit 3552efa and was accidentally removed in c08d19f.

1. Run: git show HEAD~1:src/pages/Chat.jsx > /tmp/chat_old.jsx
   (this gets the last-known-good version, before the removal, for reference)

2. Re-add the visualViewport height-tracking effect that existed in HEAD~1 (around old lines 329-344) into the CURRENT src/pages/Chat.jsx, placed among the other useEffect hooks near the top of the component (same relative location it was in before). Extract the exact original effect code from /tmp/chat_old.jsx (the one that sets/removes '--chat-vvh' and '--chat-vv-top' CSS custom properties via window.visualViewport resize/scroll listeners) and insert it unchanged into the current file.

3. Re-add the removed @media (max-width: 899px), @media (min-width: 900px), and @media (max-width: 360px) blocks (old lines ~1839-1842 and surrounding) into the current file's inline <style> block, extracted verbatim from /tmp/chat_old.jsx. These set --chat-vvh on .chat-page.chat-thread, size .chat-top-actions buttons, hide .chat-search-toggle on desktop, and hide .chat-menu-search on mobile.

4. Re-add the .chat-search-toggle button JSX that was removed, extracted from /tmp/chat_old.jsx, in the same location relative to the other chat-top-actions buttons.

5. Restore maxWidth: 'min(160px, 38vw)' and maxWidth: 'min(140px, 34vw)' on the recording/typing labels (currently plain 160px/140px per the diff) back to the responsive vw-based values from /tmp/chat_old.jsx.

Do NOT modify any of today's session's changes (voice note fix, R2 migration, audio labels, video lightbox, MP3 icon). Only restore the 4 items above.

Run npx eslint src/pages/Chat.jsx and npm run build. Report both results and confirm the --chat-vvh effect and all 3 media query blocks are present again via grep -n "chat-vvh" src/pages/Chat.jsx.