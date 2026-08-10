# Response — Fix applied: `beforeinstallprompt` hygiene in `App.jsx`

Task source: `docs/claudehelp.md` follow-up. Scoped to `src/App.jsx` only. `InstallPrompt.jsx` left untouched (known dead code, flagged previously).

## What changed

### 1. Await `userChoice` + clear state either way (`handleInstall`, was lines 241–245)
```js
async function handleInstall() {
  if (!installPrompt) return
  try {
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    console.log('[app] install prompt outcome:', outcome)
  } catch (err) {
    console.warn('[app] install prompt failed', err)
  } finally {
    // Clear either way — the event is single-use, so a spent prompt must
    // not remain tappable.
    setInstallPrompt(null)
  }
}
```
- `userChoice` is now awaited and the outcome (`accepted` / `dismissed`) is logged.
- `setInstallPrompt(null)` moved into `finally`, so state clears on accept, dismiss, **or** a thrown error (e.g. spent event) — the Install button can no longer remain visible on a dead prompt.

### 2. Stale-event risk — fixed by the same `finally` block
The deferred event is single-use; clearing state in `finally` guarantees it's discarded after the first `.prompt()` call regardless of outcome, so it can't be tapped twice.

### 3. Listener cleanup (`useEffect`, was lines 195–200)
```js
useEffect(() => {
  const onBeforeInstallPrompt = (e) => {
    e.preventDefault()
    setInstallPrompt(e)
  }
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
}, [])
```
Named handler + cleanup function returned, per React effect hygiene.

## Verification

- **`npm run build`** — ✓ built in 3.43s, no errors.
- **`npx eslint src/App.jsx`** — 3 errors, all **pre-existing** and unrelated to this change:
  - `131:7` setState-in-effect (the `isSupabaseConfigured` guard)
  - `140:11` / `141:11` `fetchRole`/`setupPush` accessed before declaration (function-hoisting style)
  - None touch the edited regions (listener at 195–202, `handleInstall` at 243–255).
- **IDE diagnostics** — no errors.

Net change: +14 / −6 lines in `src/App.jsx`. No other files touched.
