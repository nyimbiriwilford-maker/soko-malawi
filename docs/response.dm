# Task 10 — Bump SW cache version v7 → v8

Status: DONE. One-line change to `public/sw.js:1`.

## Change

```js
const CACHE = 'sokomw-v8'
```
No other caching logic, install/activate handlers, or fetch strategy touched.

## Confirm: activate already drops old caches

`public/sw.js:11-16` (unchanged):
```js
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})
```
On activate it enumerates all caches, keeps only the one matching the current `CACHE` name, and deletes the rest — so the version bump alone is sufficient. Old clients (any cache named `sokomw-v7` or earlier) get cleaned up automatically on their next visit, and `self.skipWaiting()` (install handler, `:7`) + `self.clients.claim()` ensure the new worker takes over promptly.

## Verification

- `npm run build` → passes (3.27s); `dist/sw.js` regenerated with `const CACHE = 'sokomw-v8'` confirmed.
- This directly addresses the stale-bundle symptom reported in Task 9: a device previously holding `sokomw-v7` (whose `/index.html` cached shell pointed at older hashed chunks) will now drop that cache on activate and re-cache the fresh shell.
