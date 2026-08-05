Find the Content Security Policy definition in the project. Check these locations in order:
1. vercel.json (headers section)
2. index.html (a <meta http-equiv="Content-Security-Policy"> tag)
3. vite.config.js (any headers/CSP config)

Show the full current CSP string. Then update it to add the R2 domains to the relevant directives:

- media-src: add https://pub-67bc811f19044f60bd6fb142f7280dcf.r2.dev and https://*.r2.dev
- connect-src: add https://*.r2.cloudflarestorage.com and https://*.r2.dev
- img-src: add https://*.r2.dev (if not already present — for listing images on mobile)

Show exactly what changed before applying. Run npm run build and confirm it passes.