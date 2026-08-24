# Buyer-Surface Premium UI Credibility Pass (Level 2)

## Context
Credibility audit of the SokoMW shop UI (evidence-based; see `docs/response.dm` audit log). The storefront works well structurally but signals like a prototype: three brand greens, two currency formats (`MK` vs `MWK`), native `alert()` dialogs, emoji-as-icons, a permanent negative "Unverified" stat, thin empty-policy states, and no reassurance at the purchase decision point.

**Scope (decided):** Buyer journey only — `ShopPage.jsx`, `ListingDetail.jsx`, `PlaceOrderModal.jsx`, `OrdersPage.jsx`, `src/lib/orders.js` — plus one borrowed "C" element: a shared currency formatter + brand-green unification. Seller surfaces (`ShopDashboard`, `ShopSetup`), `SokoNav`, and login stay untouched this round.

**Depth (decided):** Level 2 — premium refinement. No full layout/spacing-system rebuild; targeted hierarchy, trust, and identity fixes.

## Decisions (user-confirmed)
1. Currency: **`MK 25,000`** everywhere (local notation wins; formal `MWK` goes away).
2. 4th stats slot: replace amber **"Unverified"** with **"Open since <Mon YYYY>"** (from `shops.created_at`). Verification remains a positive-only badge (the header logo pill already does this).
3. Brand green unified to `#0F9D58` (accent) / `#0a7a44` (dark) across in-scope files; ShopDashboard's `#2e7d32` is out of scope.
4. Assurance copy must be **fact-based** — no escrow/protection claims (escrow is Phase 2, not built). Use: "Pay on delivery", "Inspect before you pay", "Rate your order after delivery".

## Ordered Tasks

### 1. Shared formatter — new file `src/lib/format.js`
- `export function formatPrice(amount)` → `"MK " + Number(amount||0).toLocaleString('en-US')`.
- In `src/lib/orders.js`: rename `formatMWK` → `formatPrice`, keep `export { formatPrice as formatMWK }` alias so existing imports (OrdersPage, OrderManager, PlaceOrderModal) keep working; body already returns `MK …` (confirm).
- In `OrdersPage.jsx` and `PlaceOrderModal.jsx`: switch imports to `formatPrice`.

### 2. `ShopPage.jsx` — storefront trust hierarchy
- **Delete dead code:** remove `PLACEHOLDER_LISTINGS` / `PLACEHOLDER_SIMILAR_SHOPS` arrays (~lines 84–98) — confirmed unused.
- **Stats bar reorder + 4th slot swap** (~lines 2675–2720): order = **Shop Rating (with review count)** → Listings → Followers → **Open since** (`new Date(shop.created_at)` → `May 2026` style; hide slot / show "New shop" neutral gray if missing). Delete the amber `Unverified` rendering entirely.
- **Verify banner** (~2576–2672): replace emoji icons `✅ 📈 🔒` with lucide SVGs (`ShieldCheck`, `TrendingUp`, `Lock` — lucide-react already in deps and imported patterns exist in NotificationToast).
- **Empty policies fallback** (~3103, ~3243 conditions): when no policies set, render one neutral, honest line with an icon: *"Delivery and returns aren't listed — ask the shop in chat before ordering."* Do NOT invent policy text.
- **Kill 2 `alert()`s** (lines 1635, 2284): convert to local inline error message state near the triggering action (owner-only paths: report/feedback + theme update); no new global component.
- Currency: already `MK` (4 sites) — leave.

### 3. `ListingDetail.jsx` — decision-point credibility
- **Typography:** delete the `@import url('...Inter...')` line (~409) and inline `font-family: 'Inter'` overrides; fall back to canonical stack (`'DM Sans', 'Sora', system-ui` per `index.css`). No other font-loading changes.
- **Green unification (constrained):** replace brand-accent literals `#1a7a4a` → `#0F9D58` ONLY in price/CTA/link accents (`.bigPrice`, `.chatBtn`, `.barChatBtn`, `.mobileChatBtn`, `.tagChip`, `.safetyLink`, `.viewMapLink`, sidebar check circles, breadcrumb icons). **Do NOT touch** `CAT_META` / `CONDITION_META` / `AVAILABILITY_META` semantic category colors, reds (`#dc2626`), or neutrals.
- **Currency:** swap all 13 `MWK …` template/string sites to `formatPrice(...)` (import from `src/lib/format.js`).
- **Kill 2 `alert()`s** (1258, 1309 — feature-listing errors): local inline error line in the sticky bars.
- **Assurance strip** in the sidebar CTA card, directly below the Place Order button: single compact row of 3 items (lucide `Banknote` "Pay on delivery", `Eye` "Inspect before paying", `Star` "Rate after delivery"), styled like the existing `trustRow` pattern (muted, 12px, icons in soft tinted squares). Same strip (condensed to one line) at the bottom of `PlaceOrderModal.jsx` above the total.
- Keep the already-correct stock/availability gating untouched.

### 4. `OrdersPage.jsx` — polish pass
- Swap emoji glyphs used as empty-state/action icons (🛍️, 📦, ⭐, 💬, 📍) for lucide equivalents (`ShoppingBag`, `Package`, `Star`, `MessageCircle`, `MapPin`).
- Currency via `formatPrice` (2 sites).

### 5. `PlaceOrderModal.jsx`
- Currency via `formatPrice` (7 sites).
- Replace 📦/✅ emoji glyphs with lucide (`Package`, `CheckCircle2`).
- Add the condensed assurance line (task 3) above the total row.

## Out of Scope (explicit)
- ShopDashboard / ShopSetup visual refresh (its `#2e7d32` palette stays).
- SokoNav/logo/manifest brand-name unification ("Soko Malawi" vs "SokoMw").
- Global token refactor (only buyer-surface literals change).
- Escrow/protected-payment claims — do not add them.
- Spacing/radius system rebuild (Level 3 rejected).

## Failure Modes & Guards
- **Literal over-replacement in ListingDetail:** greens appear ~40× including SVG strokes and category palettes — restrict replacements to the accent list in task 3; verify visually afterwards.
- **`shops.created_at` absent:** guard "Open since" with null-check before rendering the slot.
- **OrdersPage/OrderManager import rename:** alias re-export in `orders.js` prevents breakage for out-of-scope consumers (OrderManager, ShopDashboard).
- **Dead-placeholder removal:** arrays verified unused (1 definition each, zero render references) — safe.
- ShopPage is 3,700 lines: make surgical edits by unique surrounding context; never bulk find-replace in it.

## Validation
1. `npm run build` — must pass; bundle sizes for ShopPage/ListingDetail/OrdersPage chunks roughly unchanged.
2. `npx eslint src/pages/ShopPage.jsx src/pages/ListingDetail.jsx src/pages/OrdersPage.jsx src/components/PlaceOrderModal.jsx src/lib/format.js src/lib/orders.js` — new/changed files add no new errors (repo has pre-existing baseline; compare before/after counts).
3. Manual walkthrough (single journey, one green + one currency format throughout): `/shops` → open a shop → verify stats bar order + "Open since" + positive-only verification → open a listing → check green accents, MK pricing, assurance strip → Place Order modal → submit (or cancel) → `/orders` stepper + currency.
4. Greps proving consistency: no `alert(` and no emoji-icon remnants in the 4 scope files; no `MWK ` string literals outside comments in scope.
5. Per `AGENTS.md`: append implementation summary to `docs/response.dm`.

## Open Questions
None — scope, depth, currency, and stats-slot direction all confirmed. Hand off for implementation.
