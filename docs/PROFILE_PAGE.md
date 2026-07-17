# Profile page — function reference

**Source:** [`src/pages/Profile.jsx`](../src/pages/Profile.jsx)  
**Audience:** Anyone who needs to understand or change the logged-in Profile hub without reading ~16k lines of JSX/CSS.

> Line numbers below match the file at the time this doc was written. Search by **function name** if they drift.

---

## What this page is

The Profile page is the **marketplace hub** for the signed-in user (buyer + seller):

- Overview dashboard (stats, tips, activity)
- Profile settings (name, city, phone, avatar, cover)
- Selling inventory (active / sold / featured, bulk actions)
- Trust & reputation (verify, vouches, score)
- Network (followers / following)
- Buying shortcuts (chats, saved, looking-for)
- Account & security (sign-out, sessions)

**Layout:** sticky vertical nav (desktop) · bottom / more nav (mobile) · detail panel.

Most **business logic** lives in named handlers near the top half of the file. The bottom is mostly JSX and a large CSS string.

---

## Related modules (do not reinvent here)

| Module | Role |
|--------|------|
| `src/hooks/useProfileDashboard.js` | Dashboard stats, activity feed, sessions, bulk listing helpers, `blockUser`, `followSeller` |
| `src/hooks/useVouchData.js` | Trust score, vouches |
| `src/hooks/useStatuses.js` | User “status” / availability |
| `src/lib/featureListing.js` | Feature listing (free RPC or PayChangu) |
| `src/components/profile/ProfileUI.jsx` | Shared design-system pieces (`MpIcon`, badges, etc.) |
| `src/components/VerificationModal.jsx` | Identity verification wizard |
| `docs/PROFILE_DASHBOARD_BACKEND.md` | Backend / RPC notes for dashboard data |

---

## Content panels (`activeGroup`)

| Panel id | UI label | Notes |
|----------|----------|--------|
| `overview` | Overview | Default home |
| `settings` | Profile + Account | `navKey` is `profile` or `account` |
| `selling` | Selling / Sold | `sellingTab` + `invStatus` control sub-views |
| `trust` | Trust & Reputation | |
| `network` | Network | Renders `NetworkTab` |
| `buying` | Buying & Discover | Live buyer counts when opened |

Deep links:

- `?verify=1` or `state.openVerify` → open verification modal
- `?tab=selling|inventory|featured` (or `group=`) → open Selling

---

## Architecture (data flow)

```
init()
  ├─ supabase.auth.getUser()  → login redirect if missing
  ├─ loadProfile
  ├─ loadListings
  ├─ loadNetworkCounts
  └─ loadShop

useProfileDashboard(userId)  → stats, activity, sessions, suggestions
useVouchData(userId)         → trust score, vouches
useStatuses(userId)          → live status

User action → handler → Supabase / helper → setState (+ toast) → optional refreshDashboard()
```

---

## 1. Top-level helpers (outside `Profile`)

### `VerifiedSeal({ size })` · ~L50

Renders the green verified badge SVG.

**Change:** visual only (size, paths, color).

---

### `profileCompleteness(profile, user)` · ~L57

Scores how complete a profile is.

| Check key | Pass rule |
|-----------|-----------|
| `name` | `full_name` length &gt; 1 |
| `photo` | `avatar_url` set |
| `city` | `city` set |
| `phone` | phone length ≥ 7 |
| `verified` | `is_verified` |
| `email` | user email or profile email |

**Returns:** `{ checks, done, total, pct, next }`  
`next` is the first incomplete check (used by “Fix now” CTAs).

**Change:** add/remove checklist items, tips, or pass rules.

---

### `getOnlineStatus(lastSeen)` · ~L71

| Age | Label | Color |
|-----|--------|--------|
| &lt; 5 min | Online now | green |
| &lt; 60 min | Active Xm ago | amber |
| &lt; 24 h | Active Xh ago | gray |
| older / missing | Offline / `null` | gray |

Used in hero and Network cards.

---

## 2. `NetworkTab` · ~L82–635

**Props:** `sellerId`, `userId`, `suggestions`, `onFollowSuggestion`, `shopId`

Loads `seller_follows` (followers + following) and renders search/filter/sort + person cards + “People you may know”.

| Function | ~Line | Behavior | Safe edit notes |
|----------|-------|----------|-----------------|
| (load effect) | ~95 | Fetch followers + following | Change select joins / tables carefully |
| `flash(msg)` | 114 | Toast ~2.2s | Duration / styling class |
| `removeFollower(id, name)` | 119 | Confirm → delete follow → update list | Confirm copy |
| `unfollow(id, name)` | 128 | Confirm → stop following | |
| `messageUser(personId)` | 137 | Navigate `/chats?with=` | Chat route |
| `inviteToShop(personId, name)` | 142 | Insert `shop_invites` (needs `shopId`) | Needs migration if table missing |
| `blockPerson(personId, name)` | 164 | `blockUser` + strip from lists | Security migration |
| `followSuggested(sid, name)` | 179 | Prop or `followSeller` | |
| `timeAgo(ts)` | 192 | “1 day ago” style | Format only |
| `durationLabel(ts, mode)` | 204 | Follow duration subtitle | |
| `normalize(row, mode)` | 211 | DB row → card model | Add card fields here |

**Inline list pipeline (not separate functions):** search name/city · filter `all|verified|mutual` · sort `newest|oldest|verified|mutual`.

---

## 3. Overview UI primitives · ~L638–798

Presentational components — restyle freely; keep prop names if used from overview JSX.

| Component | ~Line | Purpose |
|-----------|-------|---------|
| `SectionHeader` | 638 | Title + optional action |
| `AnalyticsCard` | 658 | KPI card (value, trend, click) |
| `QuickActionCard` | 692 | Shortcut button |
| `InsightCard` | 713 | Tip / insight block |
| `EmptyState` | 723 | Empty list + CTA |
| `ActivityTimeline` | 738 | Timeline list |
| `OverviewSkeleton` | 776 | Loading placeholders |

---

## 4. Main `Profile()` — navigation & sharing

Entry: `export default function Profile()` · ~L801

| Function | ~Line | Behavior |
|----------|-------|----------|
| `openGroup(id, { edit })` | 954 | Switches content panel. Maps legacy ids: `profile`/`settings`/`account` → settings; `sold`/`selling` → selling + inventory status; `discover` → buying. Opens mobile detail; optional edit mode; scrolls section into view. |
| `isNavActive(itemId)` | 1004 | Sidebar/mobile highlight (sold vs selling, profile vs account). |
| `profilePublicUrl()` | 1012 | `{origin}/profile/{userId}` |
| `shareProfile()` | 1017 | Native share sheet, else copy link |
| `copyProfileLink()` | 1033 | Clipboard + toast |

### `openGroup` id map (do not break casually)

| Incoming `id` | Result panel | Notes |
|---------------|--------------|--------|
| `profile`, `profile-settings`, `settings` | `settings` | `navKey` profile |
| `account` | `settings` | `navKey` account |
| `discover` | `buying` | |
| `sold` | `selling` | `sellingTab` + `invStatus` = sold |
| `selling` | `selling` | active inventory |
| other | same as `id` | overview, trust, network, buying |

---

## 5. Data loading

| Function | ~Line | Source | State updated |
|----------|-------|--------|---------------|
| `init()` | 1110 | Auth + parallel loads | `user`, all profile data, `loading` |
| `loadProfile(uid)` | 1123 | `profiles` | `profile`, edit `form` |
| `loadListings(uid)` | 1135 | `listings` by `seller_id` | `listings` |
| `loadNetworkCounts(uid)` | 1144 | Follow counts + last 8 followers | counts, `recentFollowEvents` |
| `loadShop(uid)` | 1160 | `shops` by `owner_id` | `shop` |

---

## 6. Profile edit & media

| Function | ~Line | Behavior |
|----------|-------|----------|
| `saveProfile()` | 1169 | Upsert `full_name`, `city`, `phone`. If DB rejects `phone`, retries without it. |
| `uploadAvatar(e)` | 1211 | Upload to storage bucket `avatars` at `{uid}/avatar.ext` → save `avatar_url` (cache-bust query on display). |
| `uploadCover(e)` | 1228 | Image only, max ~8MB. Prefer bucket `covers`, fall back to `avatars`. Save `cover_url`. |
| `removeCover()` | 1276 | Confirm → null `cover_url` |

**When changing fields:** keep form state, upsert payload, and UI inputs aligned with Supabase columns.

---

## 7. Listings — single & bulk

| Function | ~Line | Behavior |
|----------|-------|----------|
| `toggleSold(listing)` | ~1290 | Flip listing `active` ↔ `sold` |
| `deleteListing(id)` | 1302 | Hard delete one listing |
| `shareListing(listing)` | 1309 | Share/copy `/listing/{id}`; `recordListingShare`; increment `share_count` |
| `bulkMarkSold()` | 1341 | Selected → sold (`bulkListingStatus` + per-row fallback) |
| `bulkRelist()` | 1361 | Selected → active |
| `bulkDeleteSelected()` | 1378 | Permanent multi-delete |
| `featureListing(listing)` | 1396 | Feature one active listing (`featureExistingListing`); free or payment redirect |
| `bulkBoostSelected()` | 1442 | Toast only — bulk feature intentionally disabled |
| `setInventoryStatus(status)` | 1565 | `active` \| `sold` \| `all` \| `featured`; clears selection; syncs sold tab |
| `toggleInvSelect(id)` | 1577 | Toggle multi-select |
| `toggleSelectAllInventory(ids)` | 1581 | Select all / clear |
| `openFeatureChoice()` | 1685 | Show “new vs existing” feature modal |
| `chooseFeatureNewListing()` | 1689 | Navigate `/post` with `preselectFeature` |
| `chooseFeatureExisting(listing)` | 1694 | Close modal → `featureListing` |

**Status strings used in filters:** `active`, `sold`, `deleted`, `draft` — keep consistent with DB and `isListingFeatured`.

---

## 8. Sales (invoice, delivery, reviews)

Requires `sale_orders` / `sale_reviews` tables (migrations). Failures surface as alerts mentioning migration.

| Function | ~Line | Behavior |
|----------|-------|----------|
| `ensureSaleOrder(listing)` | 1447 | Get or create sale order + invoice number |
| `showSaleInvoice(listing)` | 1473 | Copy invoice text (or alert) |
| `downloadSaleReceipt(listing)` | 1496 | Download plain-text receipt |
| `cycleDeliveryStatus(listing)` | 1523 | Cycle `none` → `pending` → `in_transit` → `delivered` |
| `showBuyerReviews(listing)` | 1542 | Load reviews for listing; alert summary |

---

## 9. Auth & sessions

| Function | ~Line | Behavior |
|----------|-------|----------|
| `signOut()` | 1585 | Supabase sign-out → `/login` |
| `confirmSignOut()` | 1590 | Confirm dialog then sign out |
| `handleRevokeSession(device)` | 1654 | Revoke other device; if current device, revoke + full sign-out |
| `connectedDevices` (useMemo) | ~1613 | Map sessions via `parseDeviceFromUserAgent`; mark current device |
| `signInMethod` | ~1595 | Human label for auth provider |

---

## 10. Completeness & time

| Function | ~Line | Behavior |
|----------|-------|----------|
| `timeAgoShort(ts)` | 1987 | Compact relative: `5m`, `2h`, `3d` |
| `handleNextCompleteness()` | 1998 | Next incomplete: verify modal / avatar file input / open profile edit |
| `buyerBadge(key)` | ~2572 | Badge numbers for Buying tiles from `buyerStats` |

---

## 11. Derived data (`useMemo`) — easy to break if renamed

These are not “functions” in the export sense, but they drive the UI. Prefer editing **thresholds / copy** here rather than in JSX.

| Name | ~Line | Purpose |
|------|-------|---------|
| `activeListing` | ~1675 | Not sold/deleted |
| `featureableListings` | ~1680 | Active and not already featured |
| `soldListings` | ~1700 | `status === 'sold'` |
| `completeness` | ~1705 | `profileCompleteness(...)` |
| `sellerLevel` | ~1711 | New → Rising → Pro → Elite (points ~12 / 28 / 55) |
| `recentActivity` | ~1758 | Sidebar last 6 listing lifecycle events |
| `dashboardTimeline` | ~1803 | Overview events from listings, follows, vouches, trust, shop (real timestamps) |
| `featuredListings` | ~1972 | Featured actives |
| `insightTips` | ~2011 | Up to 3 CTAs (complete, verify, post, feature, status) |
| `invCategories` | ~2073 | Distinct categories for inventory filter |
| `inventoryList` | ~2082 | Search / category / status / sort for Selling grid |
| `soldDashboardStats` | ~2123 | Sold KPIs (rate, avg age); RPC first, local fallback |
| `analyticsBars` | ~2150 | Chart heights (sales weighted ×3) |
| `soldCategories` | ~2165 | Categories for sold filter |
| `trustChecklist` | ~2178 | Trust Center checklist items |
| `trustAchievements` | ~2231 | Badges (or live from dashboard) |
| `trustTimeline` | ~2316 | Trust history events |
| `liveDashboardTimeline` | ~2431 | Prefer `activityFeed` DB rows; merge with `dashboardTimeline` |

`syncProfileCompletion` is called in an effect when completeness % or seller level changes (~L2311).

---

## 12. “I want to change X” map

| Goal | Go to |
|------|--------|
| Completeness checklist / tips | `profileCompleteness` |
| Online / last-seen labels | `getOnlineStatus` |
| Followers, unfollow, block, invite | `NetworkTab` |
| Switch sections / deep links | `openGroup` + URL effects near top of `Profile` |
| Save name / city / phone | `saveProfile` + form state |
| Avatar / cover photo | `uploadAvatar`, `uploadCover`, `removeCover` |
| Mark sold / delete / share one listing | `toggleSold`, `deleteListing`, `shareListing` |
| Bulk inventory actions | `bulkMarkSold`, `bulkRelist`, `bulkDeleteSelected` |
| Feature on homepage | `featureListing` + `src/lib/featureListing.js` |
| Invoice / delivery / reviews | `ensureSaleOrder` family |
| Seller tier names / thresholds | `sellerLevel` useMemo |
| Overview activity feed | `dashboardTimeline`, `liveDashboardTimeline` |
| Trust checklist / badges | `trustChecklist`, `trustAchievements` |
| Nav labels / icons / keywords | `NAV_GROUPS` (~L2496) |
| Styling | Bottom of file (`css` template string) and `ProfileUI.jsx` |

---

## 13. What not to change casually

1. **`openGroup` id mapping** — many buttons and query params depend on it.  
2. **Listing status / featured helpers** — must match DB + `isListingFeatured`.  
3. **Storage paths and buckets** — avatar/cover URLs and RLS.  
4. **Bulk feature** — product decision: one-at-a-time only (`bulkBoostSelected` is a toast).  
5. **Giant JSX/CSS block** — presentation only; put new behavior in named handlers above.

---

## 14. Selling inventory walkthrough (common edit path)

1. User opens **Selling** via `openGroup('selling')` → `activeGroup = 'selling'`, `invStatus = 'active'`.  
2. `inventoryList` filters `listings` by status/search/category/sort.  
3. Card actions call:
   - edit → navigate `/post/edit/{id}` (in JSX)
   - sold toggle → `toggleSold`
   - share → `shareListing`
   - feature star → `featureListing`
   - delete → `deleteConfirm` then `deleteListing`
4. Multi-select bar uses `invSelected` + bulk handlers.  
5. Sold sub-tab uses `setInventoryStatus('sold')` and sale helpers for invoice/delivery.

---

## 15. Function index (quick jump)

```
L50    VerifiedSeal
L57    profileCompleteness
L71    getOnlineStatus
L82    NetworkTab
  L114   flash
  L119   removeFollower
  L128   unfollow
  L137   messageUser
  L142   inviteToShop
  L164   blockPerson
  L179   followSuggested
  L192   timeAgo
  L204   durationLabel
  L211   normalize
L638   SectionHeader
L658   AnalyticsCard
L692   QuickActionCard
L713   InsightCard
L723   EmptyState
L738   ActivityTimeline
L776   OverviewSkeleton
L801   Profile (default export)
  L954   openGroup
  L1004  isNavActive
  L1012  profilePublicUrl
  L1017  shareProfile
  L1033  copyProfileLink
  L1110  init
  L1123  loadProfile
  L1135  loadListings
  L1144  loadNetworkCounts
  L1160  loadShop
  L1169  saveProfile
  L1211  uploadAvatar
  L1228  uploadCover
  L1276  removeCover
  L1290  toggleSold
  L1302  deleteListing
  L1309  shareListing
  L1341  bulkMarkSold
  L1361  bulkRelist
  L1378  bulkDeleteSelected
  L1396  featureListing
  L1442  bulkBoostSelected
  L1447  ensureSaleOrder
  L1473  showSaleInvoice
  L1496  downloadSaleReceipt
  L1523  cycleDeliveryStatus
  L1542  showBuyerReviews
  L1565  setInventoryStatus
  L1577  toggleInvSelect
  L1581  toggleSelectAllInventory
  L1585  signOut
  L1590  confirmSignOut
  L1654  handleRevokeSession
  L1685  openFeatureChoice
  L1689  chooseFeatureNewListing
  L1694  chooseFeatureExisting
  L1987  timeAgoShort
  L1998  handleNextCompleteness
  L2572  buyerBadge
```

---

## Maintaining this doc

When you add or rename a Profile handler:

1. Put **new behavior in a named function** near the other handlers (not buried in JSX).  
2. Update the index section above and the relevant “I want to change X” row.  
3. If the change depends on Supabase schema, note the table/column here and in the matching backend doc.
