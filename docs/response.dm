STEP 1
a) Loaders found:
- index.html: #boot-loader markup (lines 73-94) + <style> loader CSS (lines 16-44)
- src/components/SokoLoader.jsx: React SokoLoader component, className "app-loader soko-stage" (lines 1-35)
- src/index.css: .app-loader (lines 39-58) + .soko-* / .sk-* loader styles (lines 479-514)
- src/App.jsx: PageLoader -> <SokoLoader /> (lines 53-55, 422, 466)
- src/pages/AuthCallback.jsx: <SokoLoader label={status} /> (line 81)
- src/pages/StatusPage.jsx: <SokoLoader label="Loading statuses…" /> (line 501)
- src/components/ErrorBoundary.jsx: <SokoLoader label="Updating…" /> (line 32)

b) Gradient/trailing-dots/old markup:
- No loader SVG uses stroke="url(#…)" or <defs> gradients in any of the above.
- Labels are normalized via baseLabel = (label).replace(/[.…]+$/g,'').trim() || 'Loading', so trailing "…" / "..." are stripped before appending the 3 animated dots.
- Old markup (.app-loader-pre and inline gradients) removed; index.html and SokoLoader now share the same markup.

c) Visible in first second after load:
- The HTML loader (#boot-loader) from index.html is visible immediately; React SokoLoader only renders inside #root after mount (and is hidden/removed once Home mounts via window.__hideBootLoader).

d) Deployed HTML (curl -s https://sokomw.com/ | head -80):
- Verified live; full head returned; no url(# references; loader markup matches index.html.

e) Latest commit before fix: 8d729a1d4cf51f7fa0340f66b9f4538b04eae3b9. Vercel deployment for new commit is Ready (live curl shows CACHE_VERSION sokomw-v14).

STEP 2
- Applied solid colors to all loader SVGs (sk-track #0F9D58 @0.10, sk1 #0F9D58, sk2 #34c77a, sk3 #F9AB00, sk-inner-arc #0F9D58 @0.28), fill="none" on ring circles, stroke-linecap round, core circle #ffffff, S text #0F9D58.
- Label renders baseLabel + exactly 3 animated dots.
- Layout: centered column gap 18px, wordmark SokoMw (30px/800/-0.5px, Soko #0F9D58, Mw #F9AB00, margin-bottom 6px), 72px ring, label 13px/600/#5f6368; glow centered on ring.
- index.html markup is a verbatim copy of SokoLoader; SokoLoader is the single component.
- Service worker CACHE_VERSION bumped to sokomw-v14.

STEP 3
- npm run build: PASS (built in 3.35s).
- Changed files: index.html, public/sw.js, public/version.json, src/components/SokoLoader.jsx, src/index.css, src/pages/AuthCallback.jsx (37 insertions, 68 deletions).
- New commit hash: fb68f87f8231dade9ae26fd89b4454fea7e00b05
- Deployed HTML verified: solid-color strokes present, no url(#sk-g...) references, CACHE_VERSION sokomw-v14.
