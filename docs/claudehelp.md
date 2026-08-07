Implement the emoji-picker keyboard-replacement swap on mobile. Reference: docs/response.md investigation.

1. In Chat.jsx, add new state near inputRef/showEmoji declarations:
   const [lockedKbHeight, setLockedKbHeight] = useState(340) // fallback px if keyboard wasn't open yet

2. Replace the emoji button onClick (Chat.jsx:4073-4082) with logic that, when opening the picker (showEmoji currently false):
   - Read the live --chat-kb-offset value off document.documentElement (getComputedStyle or the cached vv offset var already used in the visualViewport effect — reuse existing pattern, don't reinvent)
   - If that value is > 0, setLockedKbHeight(that value)
   - If it's 0 (keyboard wasn't open), leave lockedKbHeight at its current/fallback value
   - Then call inputRef.current?.blur()
   When closing the picker (showEmoji currently true): just setShowEmoji(false), no focus call here (see step 4).
   Keep setShowAttach(false) and e.stopPropagation() as-is.

3. In chat-thread.css, inside the mobile media query (max-width:899px) only, override .ep-wrap height:
   .chat-thread .ep-wrap { height: var(--ep-locked-height, 52vh); }
   Leave the desktop/base .ep-wrap rule (52vh, max-height 520px) untouched — this override only applies under the mobile breakpoint.
   In Chat.jsx, set the CSS var inline on the ep-wrap element (or a parent) from lockedKbHeight, e.g. style={{ '--ep-locked-height': `${lockedKbHeight}px` }} — only apply this inline style on mobile widths (reuse whatever mobile-detection pattern already exists in this file; do not hardcode window checks if a helper already exists).

4. In .ep-header (around Chat.jsx:3879-3891), add a new button next to the existing ✕ close button:
   - Icon: use an existing icon import if a keyboard icon is already imported from lucide-react; otherwise import { Keyboard } from 'lucide-react'
   - onClick: setShowEmoji(false), then inputRef.current?.focus()
   - aria-label="Switch to keyboard", title="Keyboard"
   - Keep the existing ✕ button unchanged (it should still just close with no focus call — closing via backdrop tap must also NOT focus, confirm the backdrop's existing onClick only does setShowEmoji(false) and does not call focus anywhere)

5. Do not touch the visualViewport useEffect (Chat.jsx:444-470) — --chat-kb-offset logic is correct and untouched.

6. Do not change desktop behavior — gate all new inline styles/height overrides to mobile only, using whatever existing mobile-detection convention this file already uses (check for an isMobile variable, matchMedia hook, or width-based helper already in scope before introducing a new one).

After implementing, write a summary to docs/response.md covering:
- Exact code diff for each of the 4 changed spots
- What value lockedKbHeight ended up holding in your reasoning for the fallback (340px) — confirm whether an existing default keyboard-height constant already exists elsewhere in the file that should be reused instead
- Confirm no changes were made to desktop rendering
- Any existing mobile-detection helper you found and reused (name + location)