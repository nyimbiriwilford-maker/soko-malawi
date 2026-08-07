# Emoji picker: keyboard-replacement swap on mobile

Task source: `docs/claudehelp.md`. Implemented + verified.

## Implementation summary

On mobile the emoji picker now **replaces** the keyboard at the same measured height (WhatsApp-style) instead of stacking above it, and there's a **switch-back-to-keyboard** button in the picker header.

## 1. New state near inputRef/showEmoji (`Chat.jsx`)

```js
const [lockedKbHeight, setLockedKbHeight] = useState(340) // fallback px if keyboard wasn't open yet
const [isMobile, setIsMobile]             = useState(() =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches
)
```
Plus a matchMedia subscription effect (change-only, no sync setState → lint-clean):
```js
useEffect(() => {
  const mq = window.matchMedia('(max-width: 899px)')
  const onChange = e => setIsMobile(e.matches)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}, [])
```
Imported `Keyboard` from `lucide-react`.

### 2. Emoji button `onClick` (opening = blur + lock height; closing = plain)

```js
onClick={e => {
  e.stopPropagation(); setShowAttach(false)
  if (!showEmoji) {
    const cs = getComputedStyle(document.documentElement)
    const kb = parseFloat(cs.getPropertyValue('--chat-kb-offset')) || 0
    if (kb > 0) setLockedKbHeight(kb)
    inputRef.current?.blur()
    setShowEmoji(true)
  } else {
    setShowEmoji(false)
  }
}}
```
- Reads the **live** `--chat-kb-offset` off `<html>` (the same var the `visualViewport` effect writes) via `getComputedStyle` — reuses the existing pattern, no duplicated keyboard logic.
- `>0` → locks that height; `0` (keyboard never open) → keeps current/fallback `340`.
- Then `inputRef.current?.blur()` so the keyboard closes.
- Closing just `setShowEmoji(false)`; focus is handled in step 4. `setShowAttach(false)` + `stopPropagation()` kept.

### 3. Inline lock height on `ep-wrap` (mobile only)

```js
<div ref={emojiPickerRef} className="ep-wrap"
     onClick={e => e.stopPropagation()}
     style={isMobile ? { '--ep-locked-height': `${lockedKbHeight}px` } : undefined}>
```

### 4. `.ep-header` — added switch-back-to-keyboard button (✕ unchanged)

```jsx
<button type="button" className="ep-close"
  onClick={() => { setShowEmoji(false); inputRef.current?.focus() }}
  aria-label="Switch to keyboard" title="Keyboard">
  <Keyboard size={18} strokeWidth={2} />
</button>
<button type="button" className="ep-close"   {/* ✕ unchanged */}
  onClick={() => setShowEmoji(false)} aria-label="Close emoji picker">✕</button>
```
- New Keyboard button closes picker **then** `inputRef.current?.focus()` (reopens the keyboard).
- Existing ✕ unchanged — closes only, **no focus call**.
- Backdrop confirmed clean: `.ep-backdrop onClick={() => setShowEmoji(false)}` only, no focus anywhere.

### 5. CSS override — mobile media query only, after the base `.ep-wrap` rule

```css
/* Mobile only: picker replaces the keyboard, so height = locked keyboard height */
@media (max-width: 899px) {
  .chat-thread .ep-wrap {
    height: var(--ep-locked-height, 52vh);
  }
}
```
Base rule (`52vh / max-height 520px`) untouched. Placed **after** the base rule in `chat-thread.css` so cascade wins.

## Reasoning: lockedKbHeight fallback (340px)

- **No existing keyboard-height constant exists anywhere in `Chat.jsx`** (searched `lockedKb|kb-height|340|keyboardHeight` — none). The only keyboard value is the live `--chat-kb-offset` computed var, which is read at open time.
- The `340` fallback is therefore the default/quoted constant from the task spec, kept as-is for the "keyboard wasn't open yet" case (`--chat-kb-offset === 0`), when the CSS `var(--ep-locked-height, 52vh)` also falls back to `52vh`. On mobile the picker uses the fallback only until the first open-with-keyboard measure.

## Desktop behavior — unchanged

- All new inline styles/height are gated by `isMobile` (matchMedia `(max-width: 899px)`).
- The CSS override is inside `@media (max-width: 899px)` only.
- On desktop the emoji button toggles the picker exactly as before (`blur()` is a no-op for a non-focused element; height var is not applied), and the base `.ep-wrap` `52vh/520px` rule is untouched.

## Mobile-detection helper used

No pre-existing helper existed in `Chat.jsx` (verified: no `isMobile`, `windowWidth`, `matchMedia`, or innerWidth usage in that file). Reused the repo's **CSS breakpoint convention `max-width: 899px`** (same value as `chat-thread.css` mobile media query) via a small `window.matchMedia('(max-width: 899px)')` hook, matching the existing `Profile.jsx:1093` matchMedia pattern. Introduced as a file-local hook because none existed.

## Verification

- `npx eslint src/pages/Chat.jsx` → **14 problems (10 errors, 4 warnings)**, identical to the pre-existing baseline — **no new lint errors** (the one transient `set-state-in-effect` from my first draft was removed by lazy state init).
- `npm run build` → `✓ built in 4.04s`. Passes.

## Changed spots (4 + supporting)

1. `Chat.jsx` — import `Keyboard`, state (`lockedKbHeight`, `isMobile`), matchMedia effect.
2. `Chat.jsx` — emoji button `onClick` logic.
3. `Chat.jsx` — `ep-wrap` inline `--ep-locked-height` (mobile only) + Keyboard switch button in `.ep-header`.
4. `chat-thread.css` — mobile-only `.ep-wrap` height override.
Base `visualViewport` effect (`--chat-kb-offset`) and desktop `.ep-wrap` left untouched.