Build: `npm run build` passes (? built).

Bridge description:
- File: src/pages/Home.jsx
- Element: `<div className="bc-bridge status-cat-bridge">` between the status rail wrapper and the `<div className="soko-settle soko-settle-d3">` wrapping `<CategoryGrid />`.
- Class: `bc-bridge status-cat-bridge`. It rendered a 36px (28px on mobile) band with a gradient background plus a centered row: two thin gradient lines flanking a 5px green dot (`#0F9D58`).
- Wrapper/margins brought by it: the div itself had height 36px/28px, padding `0 20px`, plus the following category section's top padding and the status section's bottom padding.

Files changed: src/components/HomeStatusSection.jsx, src/pages/Home.jsx.

Exact diff:

```diffdiff --git a/src/components/HomeStatusSection.jsx b/src/components/HomeStatusSection.jsx
index d74a03d..612e10e 100644
--- a/src/components/HomeStatusSection.jsx
+++ b/src/components/HomeStatusSection.jsx
@@ -715,7 +715,7 @@ export default function HomeStatusSection({ navigate, stories, loading, error, o
     <>
       <style>{`
         .hs-rail::-webkit-scrollbar { display: none; }
-        .hs-rail { padding: 24px 14px 32px; margin: 0; scroll-padding-left: 14px; overflow-x: auto; overflow-y: hidden; position: relative; z-index: 1; background: transparent; height: auto; max-height: none; }
+        .hs-rail { padding: 24px 14px 24px; margin: 0; scroll-padding-left: 14px; overflow-x: auto; overflow-y: hidden; position: relative; z-index: 1; background: transparent; height: auto; max-height: none; }
         .hs-rail-wrap { width: 100vw; margin-left: calc(50% - 50vw); margin-top: 0; padding-top: 0; background: transparent; overflow: visible; position: relative; z-index: 2; }
         .hs-story-btn:active { transform: scale(0.97); transition: transform 0.12s ease; }
         .hs-rail-arrow { opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
@@ -798,7 +798,7 @@ export default function HomeStatusSection({ navigate, stories, loading, error, o
       `}</style>
 
       <section className="hs-section" style={{
-        padding: '12px 0 16px',
+        padding: '12px 0 0',
         marginBottom: 0,
         background: 'transparent',
       }}>
diff --git a/src/pages/Home.jsx b/src/pages/Home.jsx
index 924f77b..ac99625 100644
--- a/src/pages/Home.jsx
+++ b/src/pages/Home.jsx
@@ -553,21 +553,22 @@ function GlobalStyles() {
         .soko-featured-stories-grid { grid-template-columns: 1fr !important; }
 
         .soko-cat-section {
-          padding: 12px 0 8px !important;
+          padding: 0 0 8px !important;
+          margin-top: 4px;
         }
         .soko-cat-section > div {
           max-width: none !important;
           width: 100% !important;
         }
         .cat-header-row {
-          padding: 0 14px;
+          padding: 0 20px;
           margin-bottom: 12px !important;
         }
         .soko-cat-grid {
           display: grid !important;
           grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
           gap: 8px !important;
-          padding: 0 14px 4px !important;
+          padding: 0 20px 4px !important;
           margin: 0 !important;
           width: 100% !important;
           max-width: 100% !important;
@@ -606,7 +607,15 @@ function GlobalStyles() {
       }
 /* ÔöÇÔöÇ Desktop only: compact all categories into ONE horizontal row (mobile untouched) ÔöÇÔöÇ */
       @media (min-width: 769px) {
+        .soko-cat-section {
+          padding: 0 24px 8px !important;
+          margin-top: 12px;
+        }
+        .cat-header-row {
+          padding: 0 24px;
+        }
         .soko-cat-grid {
+          padding: 0 24px 4px !important;
           grid-template-columns: repeat(9, minmax(0, 1fr)) !important;
           gap: 10px !important;
         }
@@ -641,6 +650,9 @@ function GlobalStyles() {
         }
       }
       @media (max-width: 768px) {
+        .cat-header-row {
+          padding: 0 14px;
+        }
         .soko-cat-grid {
           display: flex !important;
           flex-direction: row !important;
@@ -1055,7 +1067,7 @@ function CategoryGrid({ navigate, onCategoryChange }) {
   }
 
   return (
-    <section className="soko-cat-section" style={{ padding: '20px 20px 8px', background: '#fff' }}>
+    <section className="soko-cat-section" style={{ padding: '0 20px 8px', background: '#f8f9fa' }}>
       <div style={{ maxWidth: 1400, margin: '0 auto' }}>
         {/* ÔÇö Section header ÔÇö */}
         <div className="cat-header-row" style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
@@ -5802,30 +5814,6 @@ export default function Home() {
       </div>
 
       {/* ÔÇö Statuses ÔåÆ Categories transition ÔÇö */}
-      <div className="bc-bridge status-cat-bridge" style={{
-        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
-        height:36, padding:'0 20px',
-        background:'linear-gradient(180deg, #f8f9fa 0%, #FAFBFC 45%, #FFFFFF 100%)',
-      }}>
-        <div style={{
-          display:'flex', alignItems:'center', gap:10,
-          width:'100%', maxWidth:300, margin:'0 auto',
-        }}>
-          <div style={{
-            flex:1, height:1, borderRadius:1, opacity:.85,
-            background:'linear-gradient(90deg, transparent, #D1D5DB)',
-          }} />
-          <div style={{
-            width:5, height:5, borderRadius:'50%', flexShrink:0,
-            background:'#0F9D58', opacity:.5,
-          }} />
-          <div style={{
-            flex:1, height:1, borderRadius:1, opacity:.85,
-            background:'linear-gradient(90deg, #D1D5DB, transparent)',
-          }} />
-        </div>
-      </div>
-
       <div className="soko-settle soko-settle-d3">
         <CategoryGrid navigate={navigate} onCategoryChange={handleCategoryChange} />
       </div>
@@ -5867,7 +5855,7 @@ export default function Home() {
         @media (max-width: 980px) {
           .bc-bridge { height: 28px !important; }
           .ll-lf-bridge { height: 24px !important; }
-          .status-cat-bridge { height: 28px !important; }
+
         }
         @media (max-width: 767px) {
           .section-divider { gap: 4px; padding: 6px 0 4px; }
```