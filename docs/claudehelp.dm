Task 10 — Bump service worker cache version

File: public/sw.js

Change: Update the cache name constant (currently CACHE = 'sokomw-v7') to the next version ('sokomw-v8'). This is a one-line change — do not touch any other caching logic, install/activate handlers, or fetch strategy unless bumping the version alone doesn't force old caches to be dropped on activate (in which case, report what's missing, don't add new caching behavior).

Verify: npm run build passes. Confirm the existing activate handler already deletes caches not matching the current name (report the relevant code so we know old clients get cleaned up automatically on next visit).