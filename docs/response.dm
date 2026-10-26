Build: `npm run build` passes (? built).

Files changed: src/components/HomeStatusSection.jsx, src/pages/Home.jsx.

Temporary testing flags added (Home.jsx):
- `?emptyStatus=1` forces empty rail (no statuses, no error, loading false).
- `?errorStatus=1` forces error rail (error card + Retry).
Remove them by deleting the two `forceEmptyStatus`/`forceErrorStatus` lines and reverting the `HomeStatusSection` props to `stories={stories}`, `loading={storiesLoading}`, `error={storiesError}`.

Breakpoint verification (by shared sizing):
- Create Status card keeps `.hs-add-btn` (same responsive flex-basis/width as `.hs-story-btn` real cards: 148/170/196/210px), `aspect-ratio: 9 / 14`, same radius (16/18px).
- Empty (no error): only the Create Status card renders; hint shown only when `rankedStories.length === 0`.
- A real status appearing beside it uses the same card width classes, so no layout jump.
- Error state keeps a single compact card (`.hs-error-card`) at the same responsive sizes with alert icon, texts, Retry pill.

Exact diff:

```diffdiff --git a/src/components/HomeStatusSection.jsx b/src/components/HomeStatusSection.jsx
index 2bf077d..d74a03d 100644
--- a/src/components/HomeStatusSection.jsx
+++ b/src/components/HomeStatusSection.jsx
@@ -1,5 +1,5 @@
 import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
-import { ChevronRight, Plus, Sparkles } from 'lucide-react'
+import { ChevronRight, Plus } from 'lucide-react'
 import { STATUS_META } from '../constants/homeConstants'
 import { supabase } from '../lib/supabase'
 import { isStatusVideoUrl, isStatusColorBoard } from '../utils/statusVideo'
@@ -783,18 +783,18 @@ export default function HomeStatusSection({ navigate, stories, loading, error, o
         }
         @media (min-width: 1600px) {
           .hs-story-btn, .hs-add-btn { flex-basis: 210px; width: 210px; }
-          .st-empty-card { flex-basis: 210px; width: 210px; }
+          .hs-error-card { flex-basis: 210px; width: 210px; }
         }
-        .st-empty-card { flex: 0 0 148px; width: 148px; aspect-ratio: 9 / 14; border-radius: 16px; overflow: hidden; scroll-snap-align: start; }
-        @media (min-width: 768px) { .st-empty-card { flex-basis: 170px; width: 170px; } }
-        @media (min-width: 1100px) { .st-empty-card { flex-basis: 196px; width: 196px; border-radius: 18px; } .st-empty-card .st-empty-title { font-size: 15px; } .st-empty-card .st-empty-sub { font-size: 12.5px; } .st-empty-card .st-empty-icon { width: 56px; height: 56px; } }
-        @keyframes stEmptyFloat { from { transform: translateY(0); } to { transform: translateY(-4px); } }
+        .hs-error-card { flex: 0 0 148px; width: 148px; aspect-ratio: 9 / 14; border-radius: 16px; box-sizing: border-box; scroll-snap-align: start; }
+        @media (min-width: 768px) { .hs-error-card { flex-basis: 170px; width: 170px; } }
+        @media (min-width: 1100px) { .hs-error-card { flex-basis: 196px; width: 196px; border-radius: 18px; } }
+        .hs-add-btn:focus-visible { outline: 2px solid #0F9D58; outline-offset: 3px; }
         @media (hover: hover) and (pointer: fine) {
-          .st-empty-card:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 14px 32px rgba(0,0,0,0.18); }
-          .st-empty-card button:hover { background: #0a7a44; }
+          .hs-add-btn:hover { border-color: #0F9D58 !important; background: #f4fbf7 !important; }
+        }
+        @media (min-width: 1100px) {
+          .hs-add-btn .hs-create-plus { width: 48px !important; height: 48px !important; }
         }
-        .st-empty-card button:focus-visible { outline: 2px solid #0F9D58; outline-offset: 3px; }
-        @media (prefers-reduced-motion: reduce) { .st-empty-card [style*="animation"] { animation: none; } }
       `}</style>
 
       <section className="hs-section" style={{
@@ -851,33 +851,50 @@ export default function HomeStatusSection({ navigate, stories, loading, error, o
                       onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                       style={{
                         flexShrink: 0,
-                        cursor: 'pointer', padding: 0, fontFamily: 'inherit',
-                        textAlign: 'center', background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
+                        cursor: 'pointer', padding: 14, fontFamily: 'inherit',
+                        textAlign: 'center', background: '#ffffff',
                         scrollSnapAlign: 'start',
-                        border: '2px dashed ' + G.green,
+                        border: '1.5px dashed rgba(15,157,88,0.45)',
                         boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                         transition: 'all 0.25s ease',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
-                        gap: 8,
+                        gap: 10,
+                        boxSizing: 'border-box',
                       }}
                     >
-                      <div style={{
-                        width: 40, height: 40,
+                      <div className="hs-create-plus" style={{
+                        width: 44, height: 44,
                         borderRadius: '50%',
-                        background: 'linear-gradient(135deg, #0F9D58 0%, #16a34a 100%)',
+                        background: '#0F9D58',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
-                        boxShadow: '0 4px 12px rgba(15,157,88,0.25)',
+                        boxShadow: '0 6px 16px rgba(15,157,88,0.28)',
                       }}>
                         <Plus size={22} color="#fff" strokeWidth={2.5} />
                       </div>
                       <div style={{
-                        fontSize: 12.5,
+                        fontSize: 13,
                         fontWeight: 700,
-                        color: G.text,
+                        color: '#202124',
                         letterSpacing: -0.2,
                       }}>
                         Create Status
                       </div>
+                      {rankedStories.length === 0 && (
+                        <div style={{
+                          fontSize: 11.5,
+                          fontWeight: 500,
+                          color: '#5f6368',
+                          lineHeight: 1.45,
+                          maxWidth: 140,
+                          textAlign: 'center',
+                          display: '-webkit-box',
+                          WebkitLineClamp: 3,
+                          WebkitBoxOrient: 'vertical',
+                          overflow: 'hidden',
+                        }}>
+                          Share what you're selling today.
+                        </div>
+                      )}
                     </button>
                     {rankedStories.slice(0, displayLimit).map(s => (
                       <StoryCard
@@ -930,92 +947,86 @@ export default function HomeStatusSection({ navigate, stories, loading, error, o
                       onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                       style={{
                         flexShrink: 0,
-                        cursor: 'pointer', padding: 0, fontFamily: 'inherit',
-                        textAlign: 'center', background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
+                        cursor: 'pointer', padding: 14, fontFamily: 'inherit',
+                        textAlign: 'center', background: '#ffffff',
                         scrollSnapAlign: 'start',
-                        border: '2px dashed ' + G.green,
+                        border: '1.5px dashed rgba(15,157,88,0.45)',
                         boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                         transition: 'all 0.25s ease',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
-                        gap: 8,
+                        gap: 10,
+                        boxSizing: 'border-box',
                       }}
                     >
-                      <div style={{
-                        width: 40, height: 40,
+                      <div className="hs-create-plus" style={{
+                        width: 44, height: 44,
                         borderRadius: '50%',
-                        background: 'linear-gradient(135deg, #0F9D58 0%, #16a34a 100%)',
+                        background: '#0F9D58',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
-                        boxShadow: '0 4px 12px rgba(15,157,88,0.25)',
+                        boxShadow: '0 6px 16px rgba(15,157,88,0.28)',
                       }}>
                         <Plus size={22} color="#fff" strokeWidth={2.5} />
                       </div>
                       <div style={{
-                        fontSize: 12.5,
+                        fontSize: 13,
                         fontWeight: 700,
-                        color: G.text,
+                        color: '#202124',
                         letterSpacing: -0.2,
                       }}>
                         Create Status
                       </div>
+                      {rankedStories.length === 0 && (
+                        <div style={{
+                          fontSize: 11.5,
+                          fontWeight: 500,
+                          color: '#5f6368',
+                          lineHeight: 1.45,
+                          maxWidth: 140,
+                          textAlign: 'center',
+                          display: '-webkit-box',
+                          WebkitLineClamp: 3,
+                          WebkitBoxOrient: 'vertical',
+                          overflow: 'hidden',
+                        }}>
+                          Share what you're selling today.
+                        </div>
+                      )}
                     </button>
 
                     {error ? (
-                      <section className="st-empty-card" aria-label="Couldn't load statuses"
-                        style={{
-                          flex: '0 0 148px', width: 148, aspectRatio: '9 / 14', borderRadius: 16,
-                          background: 'linear-gradient(160deg, #e8f5ee 0%, #f0fdf4 55%, #fff8e1 100%)',
-                          border: '1px solid rgba(15,157,88,0.14)',
-                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
-                          gap: 10, padding: 16, boxSizing: 'border-box', textAlign: 'center',
-                          scrollSnapAlign: 'start',
-                        }}
-                      >
-                        <div style={{ fontSize: 14, fontWeight: 800, color: '#202124', fontFamily: G.fontDisplay }}>Couldn't load statuses</div>
-                        <div style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', lineHeight: 1.45, maxWidth: '100%' }}>Check your connection and try again.</div>
-                        <button type="button"
-                          onClick={() => { if (typeof onRetry === 'function') onRetry() }}
-                          style={{
-                            border: 'none', background: '#0F9D58', color: '#fff', borderRadius: 999,
-                            padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
-                            fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(15,157,88,0.28)',
-                          }}
-                        >
-                          Retry
-                        </button>
-                      </section>
-                    ) : (
-                      <section className="st-empty-card" aria-label="No statuses yet"
+                      <section className="hs-error-card" aria-label="Couldn't load statuses"
                         style={{
-                          flex: '0 0 148px', width: 148, aspectRatio: '9 / 14', borderRadius: 16,
                           background: 'linear-gradient(160deg, #e8f5ee 0%, #f0fdf4 55%, #fff8e1 100%)',
                           border: '1px solid rgba(15,157,88,0.14)',
                           display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                           gap: 10, padding: 16, boxSizing: 'border-box', textAlign: 'center',
-                          scrollSnapAlign: 'start',
                         }}
                       >
-                        <div className="st-empty-icon" style={{
-                          width: 52, height: 52, borderRadius: '50%', background: '#ffffff',
+                        <div style={{
+                          width: 44, height: 44, borderRadius: '50%', background: '#ffffff',
                           boxShadow: '0 4px 14px rgba(15,157,88,0.18)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
-                          animation: 'stEmptyFloat 2.4s ease-in-out infinite alternate',
                         }}>
-                          <Sparkles size={24} color="#0F9D58" />
+                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
+                            <circle cx="12" cy="12" r="10" />
+                            <line x1="12" y1="8" x2="12" y2="12" />
+                            <line x1="12" y1="16" x2="12.01" y2="16" />
+                          </svg>
                         </div>
-                        <div className="st-empty-title" style={{ fontSize: 14, fontWeight: 800, color: '#202124', fontFamily: G.fontDisplay }}>No statuses yet</div>
-                        <div className="st-empty-sub" style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', lineHeight: 1.45, maxWidth: '100%' }}>Be the first to share what you're selling today.</div>
+                        <div style={{ fontSize: 14, fontWeight: 800, color: '#202124', fontFamily: G.fontDisplay }}>Couldn't load statuses</div>
+                        <div style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', lineHeight: 1.45, maxWidth: '100%' }}>Check your connection and try again.</div>
                         <button type="button"
-                          onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
+                          onClick={() => { if (typeof onRetry === 'function') onRetry() }}
                           style={{
                             border: 'none', background: '#0F9D58', color: '#fff', borderRadius: 999,
                             padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                             fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(15,157,88,0.28)',
                           }}
                         >
-                          Post status
+                          Retry
                         </button>
                       </section>
-                    )}
+                    ) : null}
                   </div>
                 </div>
               )}
diff --git a/src/pages/Home.jsx b/src/pages/Home.jsx
index 5d7f803..924f77b 100644
--- a/src/pages/Home.jsx
+++ b/src/pages/Home.jsx
@@ -5260,6 +5260,9 @@ export default function Home() {
   const [stories, setStories] = useState([])
   const [storiesLoading, setStoriesLoading] = useState(true)
   const [storiesError, setStoriesError] = useState(null)
+  // Temporary testing flags: ?emptyStatus=1 / ?errorStatus=1
+  const forceEmptyStatus = new URLSearchParams(window.location.search).get('emptyStatus') === '1'
+  const forceErrorStatus = new URLSearchParams(window.location.search).get('errorStatus') === '1'
 
   // ิ๖วิ๖ว Animation / location (preserved) ิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖วิ๖ว
   const [isFocused, setIsFocused] = useState(false)
@@ -5788,9 +5791,9 @@ export default function Home() {
        <div className={!storiesLoading ? 'soko-swap-in' : undefined} style={{ background: '#f8f9fa', position: 'relative', zIndex: 0, margin: 0 }}>
         <HomeStatusSection
           navigate={navigate}
-          stories={stories}
-          loading={storiesLoading}
-          error={storiesError}
+          stories={forceEmptyStatus ? [] : stories}
+          loading={forceEmptyStatus || forceErrorStatus ? false : storiesLoading}
+          error={forceErrorStatus ? new Error('forced') : (forceEmptyStatus ? null : storiesError)}
           onRetry={() => { setStoriesLoading(true); setStoriesError(null); fetchAllActiveStories(user.id, 'All').then(data => { setStories(data); setStoriesLoading(false) }).catch(err => { setStoriesError(err); setStoriesLoading(false) }) }}
           onCreateStory={handleCreateStory}
           currentUserId={user?.id}
```