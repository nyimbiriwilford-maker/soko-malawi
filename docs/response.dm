Admin boot loader fix (src/App.jsx, src/components/AdminGate.jsx, index.html):
- Central BootLoaderHider + App useLayoutEffect hide boot loader once via nested rAF on any route/state.
- AdminGate wraps session/role checks in try/catch/finally with 6s Promise.race timeout; renders checking/redirect/denied/error/ready states (all real content) with Retry.
- index.html: __hideBootLoader clears 8s timer; fallback hides loader if #root has content, else shows Reload (SW unregister, cache clear, sessionStorage clear, reload).
- Dev console.warn if route renders without hiding loader.

Build: npm run build passed.
Diff: see git diff.
EOF