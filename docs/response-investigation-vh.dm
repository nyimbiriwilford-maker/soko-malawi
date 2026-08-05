# Investigation — chat mobile viewport/scroll bug reintroduced in last push

## Summary (root cause found)

Commit **`c08d19f`** (the last push, `2026-08-04 14:03:01 +0200`) **removed the mobile viewport-height fix** for the chat thread — both the JS that tracked the visual viewport and the CSS media queries that sized `.chat-page.chat-thread` on phones. That is exactly what makes messages stop fitting/scrolling the phone viewport.

The fix was originally added in **`3552efa`** (2026-07-24, "Fix video previews in status uploader/feed/story viewer; redesign story chrome") and deleted in `c08d19f`.

## 1. Recent commits touching Chat.jsx / chat-thread.css

```
c08d19f  2026-08-04 14:03:01 +0200  Chat: fix voice notes, migrate to R2, add media labels/icons, video lightbox; Jobs/...
1fe622a  2026-07-31 14:20:02 +0200  Add call data budget cap (Task 4b/4c)
0b7e511  2026-07-30 21:58:55 +0200  Add shared sendMessageReply utility, refactor Chat.jsx, add notifications realtime publication
b956657  2026-07-30 20:54:00 +0200  migrate storage from Supabase to Cloudflare R2
3552efa  2026-07-24 17:38:25 +0200  Fix video previews in status uploader/feed/story viewer; redesign story chrome  ← ADDED the vh fix
```

## 2. Last known-good commit BEFORE this push

**`HEAD~1`** (= `1fe622a`) is the last state where the mobile fix was intact:
- `git show HEAD~1:src/pages/Chat.jsx` contains the `visualViewport` → `--chat-vvh` effect (lines 329–344) and the `@media (max-width: 899px)` block (lines 1839–1842) sizing `.chat-page.chat-thread { height/ max-height: var(--chat-vvh, 100%) !important }`.
- `git log -G "chat-vvh"` confirms only two commits ever touched it: **`3552efa` (introduced)** and **`c08d19f` (removed)**.

## 3. `git diff HEAD~1 HEAD` — exactly what was removed in `c08d19f`

### a) The visualViewport height-tracking effect (removed from Chat.jsx)
```diff
-      const vv = window.visualViewport
-      const h = vv ? Math.round(vv.height) : window.innerHeight
-      root.style.setProperty('--chat-vvh', `${h}px`)
-      // Offset for visualViewport.offsetTop when the page is scrolled under the keyboard
-      root.style.setProperty('--chat-vv-top', `${vv ? Math.round(vv.offsetTop) : 0}px`)
-    const vv = window.visualViewport
-    vv?.addEventListener('resize', apply)
-    vv?.addEventListener('scroll', apply)
-      vv?.removeEventListener('scroll', apply)
-      vv?.removeEventListener('resize', apply)
-      root.style.removeProperty('--chat-vvh')
-      root.style.removeProperty('--chat-vv-top')
```
(plus the `apply()` call / effect that set up this listener — the whole mobile-height effect is gone.)

### b) The mobile media-query block (removed from Chat.jsx's inline `<style>`)
```diff
-        @media (max-width: 899px) {
-          .chat-page.chat-thread {
-            height: var(--chat-vvh, 100%) !important;
-            max-height: var(--chat-vvh, 100%) !important;
-          }
-          .chat-top-actions { gap: 3px !important; }
-          .chat-top-actions button { width: 34px !important; height: 34px !important; }
-          /* Free header space: search lives in ⋮ menu on phones */
-          .chat-search-toggle { display: none !important; }
-        }
-        @media (min-width: 900px) {
-          .chat-menu-search { display: none !important; }
-        }
-        @media (max-width: 360px) {
-          .chat-top-actions .chat-icon-btn:not([aria-label="Chat options"]) { width: 32px !important; height: 32px !important; }
-        }
```
Also removed alongside: the search-toggle button (`<button ... className="chat-icon-btn chat-search-toggle">`) and `maxWidth: 'min(160px, 38vw)'` / `'min(140px, 34vw)'` → plain `160px`/`140px` on the recording/typing labels.

### c) chat-thread.css in the same commit
No layout/scroll/viewport changes — only `.media-video-play-hint`, `.media-video-wrap` `cursor: pointer`, and the `.voice-note.is-file-audio` play-button overrides + `.voice-type-label`. **None of these touch mobile sizing.** So the CSS file is not where the mobile fix lived — it lived in Chat.jsx's JS listener + inline `<style>` media queries.

## 4. Working tree / uncommitted changes

- `git diff HEAD -- src/pages/Chat.jsx src/styles/chat-thread.css` → **empty**: the working tree exactly matches `HEAD` (`c08d19f`). All session work is committed; nothing pending.
- Because `c08d19f` contains *both* our chat media/labels/video work **and** the `--chat-vvh` removal, and none of this session's edits ever touched the `visualViewport` code or the `<style>` media queries, the removal was **present in the working tree before/independently of today's chat work and got swept into `c08d19f`** when it was committed. It is committed (not a stray uncommitted edit), so reverting requires a code change, not just `git checkout`.

## What this means for the bug
On mobile (`max-width: 899px`), the thread's height is now whatever the base layout gives (`.chat-thread .chat-messages { flex:1; min-height:0; overflow-y:auto }`, chat-thread.css:110–122) with **no `--chat-vvh` bound** on `.chat-page.chat-thread` and **no `--chat-vvh` variable being computed** — so on phones the message list no longer hugs the visual viewport (address-bar/keyboard shifts), which is the reported "messages not scrolling/fitting the phone viewport". Reintroducing the `visualViewport` → `--chat-vvh` effect plus the `@media (max-width: 899px)` block (as in `HEAD~1`) restores the previously-working behavior.

No fixes applied per task.
