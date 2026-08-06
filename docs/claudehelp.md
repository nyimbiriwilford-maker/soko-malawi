Phase 8 — Clean up and refactor. Objective: remove obsolete code, simplify chat architecture, improve readability. No behaviour or styling changes.

═══════════════════════════════════
INVESTIGATION FIRST
═══════════════════════════════════

Run these greps in src/pages/Chat.jsx and report every match:

1. grep -n "chat-img\|chatImgGroup\|imageGroup\|img-group\|imgGroup" src/pages/Chat.jsx
   (find any old image grouping remnants)

2. grep -n "_isGroup\|_imageGroup\|_isPending\|_uploading\|_uploadProgress\|_localIndex" src/pages/Chat.jsx
   (confirm these are only used in renderMedia and the upload flow — not scattered elsewhere)

3. grep -n "groupMessages\|appendMessage" src/pages/Chat.jsx
   (confirm all call sites are the ones we placed deliberately in Phases 3-7)

4. grep -n "TODO\|FIXME\|HACK\|XXX" src/pages/Chat.jsx
   (find any leftover notes including the Phase 7 pagination TODO)

5. Show the full import block at the top of Chat.jsx (lines 1-30) — check for any imports that are now unused after the refactor (e.g. anything that was used in old grouping logic, any removed components).

6. Show the full import block of src/lib/imageGroupingService.js — confirm defaultService / createImageGroupingService / ImageGroupingService class are all still needed by their callers.

═══════════════════════════════════
FIXES (apply after investigation confirms)
═══════════════════════════════════

FIX A — Remove any dead imports from Chat.jsx that are no longer used after Phases 3-7.

FIX B — Add a clear section comment above the groupedMessages state and the imageGroupingService import so future developers understand the architecture at a glance:

Find: import imageGroupingService from '../lib/imageGroupingService'
Add directly above it:
// ── Image grouping ──────────────────────────────────────────────────────────
// Messages are grouped by ImageGroupingService (src/lib/imageGroupingService.js).
// groupedMessages is the render source; messages is the raw DB-row source.
// INSERT  → appendMessage (O(1) incremental)
// UPDATE/DELETE/load → groupMessages (full rebuild, rare)
// Multi-image uploads → pending group shown immediately, rebuilt after all uploads settle
// ─────────────────────────────────────────────────────────────────────────────

FIX C — Add a clear comment at the top of src/lib/imageGroupingService.js explaining its role:

Find the very first line of imageGroupingService.js (const DEFAULT_OPTIONS...) and add above it:
/**
 * ImageGroupingService
 *
 * Groups consecutive image messages from the same sender sent within
 * a configurable time window (default 60 s) into a single _isGroup bubble.
 *
 * Rules:
 *  - Only consecutive images are grouped (a text message breaks the group)
 *  - Max group size: 9 (groups larger than 9 are split automatically)
 *  - Groups are sender-scoped (never mix messages from different users)
 *
 * Public API used by Chat.jsx:
 *  - imageGroupingService.groupMessages(messages)  → full rebuild from raw rows
 *  - imageGroupingService.appendMessage(grouped, msg) → O(1) incremental append
 *
 * Do not add UI logic here. This module is pure data transformation.
 */

FIX D — Simplify the Chat.jsx TODO comment added in Phase 7 to be more concise:
Find:
// TODO Phase 7: rebuild groupedMessages when older messages are prepended
// (no pagination yet — loadMessages replaces the whole array; if older messages
// are later prepended, use: setGroupedMessages(imageGroupingService.groupMessages([...olderMessages, ...currentMessages])))

Replace with:
// TODO: when pagination is added, rebuild groupedMessages after prepending older messages:
// setGroupedMessages(imageGroupingService.groupMessages([...olderMessages, ...currentMessages]))

FIX E — In imageGroupingService.js, confirm the export at the bottom is correct and clean:
Show the last 10 lines of imageGroupingService.js. If defaultService is exported before createImageGroupingService is defined (hoisting issue), fix the order. Also confirm Chat.jsx imports the default export (imageGroupingService) and not the named class directly.

Run npx eslint src/pages/Chat.jsx src/lib/imageGroupingService.js and npm run build. Report:
- Every dead import removed (if any)
- Lint result (target: 13 problems, no new issues)
- Build result
- Confirm imageGroupingService.js exports are clean and in correct order