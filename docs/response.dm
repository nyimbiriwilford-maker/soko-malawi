# Phase 1 — Structured Price Offer message type

Task source: `docs/claudehelp.md` (truncated after "Do NOT navigate away from the
chat." — scope confirmed via Q&A: in-chat bottom sheet + structured offer card, no
accept/decline yet; storage is JSON in the message body, migration-free).

## Approach
A buyer taps a new 💰 **Offer** button in the composer → an in-chat bottom sheet opens
(no navigation) to enter an amount (MWK) and an optional note → sending persists a
message with `media_type = 'offer'` whose `body` is a versioned JSON payload. The chat
renders an Offer Card bubble. Everything reuses the existing `sendMessage` pipeline
(optimistic bubble, retries, disappearing timers) so text/image/emoji/deal messages are
untouched.

## Offer payload (v1)
```json
{
  "type": "offer",
  "listing_id": "listing-id-or-null",
  "amount": 145000,
  "currency": "MWK",
  "note": "Ready to buy today.",
  "status": "pending",
  "created_at": "...",
  "version": 1
}
```
Parsing/validation is centralized and forward-compatible: unknown fields are ignored,
missing/corrupt JSON, wrong `type`/`version`, or invalid `amount` are rejected safely
(`{ ok: false, reason }`) and never render as cards.

## Files changed
- **`src/utils/offerMessage.js`** (new) — `buildOfferPayload`, `parseOfferMessage`
  (versioned validation, graceful malformed-input handling, unknown-field tolerance),
  `formatOfferAmount`. Single source of truth for the schema.
- **`src/pages/Chat.jsx`**
  - Composer: new 💰 Offer button (`chat-offer-btn`, `CircleDollarSign` icon).
  - `sendOffer()`: builds the payload and sends via `sendMessage(JSON, 'offer', null,
    { listing_id }, { replyTo: null })` — `replyTo: null` keeps JSON out of reply
    markers.
  - Offer bottom sheet (`chat-action-sheet` pattern): amount (numeric input) + optional
    note + listing context (title/listed price when available) + Cancel/Send. Send is
    disabled until a valid amount is entered.
  - Message list: `isOffer`/`offer` computed with `parseOfferMessage`; renders an
    `offer-bubble` + `offer-card` (amount, status chip, note, meta). Card is gated so it
    renders **only** when `media_type === 'offer'` **and** the payload validates.
  - Guard rails: offers can't be edited; copy outputs a readable
    "Price offer: MWK 145,000 — note" line; long-press/reply/reactions/delete/retry all
    work as on normal bubbles.
- **`src/pages/ChatList.jsx` / `src/pages/ChatListPanel.jsx`** — existing `parseOffer`
  hooks (used by the "Offers" filter + highlight line) now also recognize the structured
  JSON payload via `parseOfferMessage`; `renderLastMsg` shows "💰 MWK …" previews and
  falls back to "💰 Price offer" for malformed data.
- **`src/styles/chat-thread.css`** — offer button (desktop + mobile sizing), offer sheet
  styling, offer card/bubble styling, mobile width overrides.

## Not broken
- Text, image, video, audio, file, deal_request, and call messages render identically.
- Emoji picker, recent-emojis memory, mobile layout, insertion/caret logic untouched.

## Migration-free
Phase 1 stores the offer in the message `body` (JSON). The parser/format live in one
module, so a future phase can migrate to a jsonb column or an `offers` table (for
analytics/filtering/offers history) without changing the client-side card architecture.

## Verification
- `npx eslint src/utils/offerMessage.js` → clean (0 problems).
- `npx eslint src/pages/Chat.jsx` → 12 problems (8 errors, 4 warnings) — identical
  pre-existing baseline; none reference the edited lines.
- `npx eslint src/pages/ChatList.jsx` → 3 pre-existing errors; `ChatListPanel.jsx` →
  pre-existing baseline; none from the offer changes.
- `npm run build` → **passes** (`✓ built in 3.55s`).

---

# Phase 2 — Seller Response Workflow

Task source: `docs/claudehelp.md` — let the seller respond to price offers
(Accept / Decline / Counter), buyers only see status, one response per offer,
Decline requires confirmation, offer card updates immediately, counter offers reuse
the existing sheet prefilled and link via `parent_offer_id`.

## Semantics
- **Who can respond:** the offer's **recipient** (in the buyer→seller flow this is the
  seller). `canRespond = offer.status === 'pending' && msg.from_user !== currentUser.id`.
  This holds both with and without a loaded listing, and generalizes to chained
  counter-offers (the buyer becomes the recipient of the seller's counter and may
  accept/decline/counter it).
- **Buyers** (the offer sender) never see action buttons — only the colored status
  chip + status line (`Seller accepted your offer.`, `Seller declined your offer.`).
- **Prevent multiple responses:** once a response is stored the status leaves
  `pending`, `canRespond` goes false, and `respondToOffer` re-guards on status before
  writing. A race-safe single-response guarantee.
- **Decline confirmation:** first tap turns the Decline button into an inline
  `Confirm decline` / `Cancel` pair; nothing is written until confirmed.
- **Immediate status updates:** responses are applied **optimistically** to the local
  raw list + grouping, then persisted via `messages.update({ body })`. The existing
  realtime UPDATE handler echoes the row to both sides and rebuilds grouping, so the
  card converges instantly.

## Offer payload v1 (extended)
Responses write back onto the original offer's JSON body:
```json
{ "type":"offer", "listing_id":"...", "amount":145000, "currency":"MWK",
  "note":"...", "status":"accepted"|"declined"|"countered",
  "responded_by":"<uid>", "responded_at":"<ISO>", "counter_offer_id":"<new msg id>", "version":1 }
```
A **counter offer** is a brand-new offer message whose body adds `parent_offer_id`
(pointing at the original offer message id); the original is set to `countered` with a
`counter_offer_id` backlink. `parseOfferMessage` tolerates all fields on both shapes.

## Files changed
- **`src/utils/offerMessage.js`** — parser now surfaces `parent_offer_id`,
  `responded_by`, `responded_at`, `counter_offer_id`; added `OFFER_STATUS`, status
  labels, and `offerStatusText(offer, viewerId, isMine)` (buyer-facing lines +
  responder-view lines). Old payloads parse identically (backward compatible).
- **`src/pages/Chat.jsx`**
  - `sendMessage` now returns the inserted row (`inserted ?? null`) so the counter
    flow can backlink `counter_offer_id`.
  - `respondToOffer(msg, action)` — Accept/Decline with optimistic apply + guarded
    DB write + revert (reload) on failure.
  - `applyOfferUpdate(msgId, bodyJson)` — optimistic raw-list + grouping update,
    mirroring the realtime UPDATE handler.
  - `openCounterOffer(msg)` — opens the existing offer sheet prefilled with the
    previous offer's amount and note.
  - `sendOffer` extended: counter mode builds a new payload with `parent_offer_id`,
    sends it, then marks the original `countered` (optimistic + DB) with
    `counter_offer_id`. Sheet closes cleanly and resets `counterParent` (scrim /
    Cancel / composer button all reset it to avoid stale counter mode).
  - Offer card: colored status chip, `↩ Counter offer` tag on counters, status line,
    and the recipient-only action row (Accept / Decline→Confirm decline / Cancel /
    Counter offer). Editing offers was already blocked; copy/actions untouched.
- **`src/styles/chat-thread.css`** — status chip colors (accepted/declined/countered),
  status-line colors, parent tag, and a responsive action-button row (≥38px touch
  targets, press feedback).

## Not broken
- Phase 1 offer sending, list previews, `Offers` filter, emoji picker, mobile layout.
- Text/image/video/audio/file/deal/call messages, editing/deleting/replying.

## Verification
- `npx eslint src/utils/offerMessage.js` → clean.
- `npx eslint src/pages/Chat.jsx` → 12 problems (8 errors, 4 warnings) — identical
  pre-existing baseline; zero from the new code.
- `npm run build` → **passes** (`✓ built in 3.36s`).
- Manual logic review: seller permission gate, buyer read-only status, single
  response, decline confirm, immediate optimistic update, counter backlink.

---

# Phase 3 — Negotiation Conversation

Task source: `docs/claudehelp.md` — support full back-and-forth negotiation
(Buyer Offer ↓ Seller Counter ↓ Buyer Counter ↓ … ↓ Accepted/Declined), maintain
complete history, every offer carries `offer_id` + `parent_offer_id`, cards visually
indicate the flow, only one active offer at a time, previous offers become
**Superseded**.

## Model
- **Chain, not flat list.** Every offer payload now carries a client-generated
  `offer_id` and a `parent_offer_id` pointing at the offer it counters. `offer_id` is
  generated at build time (crypto.randomUUID, with a fallback), so a counter can
  backlink its parent before the new message row exists.
- **Complete history** = the thread itself: each counter is a real message, so every
  step stays visible. Cards add flow context on top.
- **One active offer.** Sending a counter marks the parent `superseded` immediately
  (optimistic + DB). Only the chain tip stays `pending`; `canRespond` already requires
  `pending`, and `sendOffer` re-checks the parent is still pending (guards stale state /
  double-sends). Legacy Phase-2 `countered` payloads are treated as `Superseded`.
- **Flow visualization.** A memoized `offerFlowMap` walks each connected
  parent→child chain (legacy offers keyed by message id; children sorted by
  `created_at`) and annotates every node with `{ index, total, parentIndex, hasChild,
  chain, active, ended }`. Cards render a **stepper** (1→2→3 with the current step
  highlighted and connector lines), an `↩ counter to offer N` tag, and a
  `↓ continued by offer N+1` tag on superseded cards.

## Payload (v1, extended)
```json
{ "type":"offer", "offer_id":"<uuid>", "listing_id":"...", "amount":145000,
  "currency":"MWK", "note":"...", "status":"pending"|"accepted"|"declined"|"superseded",
  "parent_offer_id":"<parent offer_id or null>",
  "responded_by":"<uid>", "responded_at":"<ISO>", "counter_offer_id":"<child offer_id>", "version":1 }
```

## Files changed
- **`src/utils/offerMessage.js`**
  - `generateOfferId()` (UUID w/ fallback); `buildOfferPayload` now always sets
    `offer_id` and accepts `parentOfferId`.
  - `parseOfferMessage` surfaces `offer_id`.
  - `OFFER_STATUS.superseded` added; `countered` kept as legacy, both render the
    "Superseded" label; `offerStatusText` handles superseded/countered.
- **`src/pages/Chat.jsx`**
  - `offerFlowMap` `useMemo` over `messages` — builds offer index, wires parent→child,
    computes per-offer chain position / active / ended.
  - `sendOffer` counter path: re-parses the parent and **requires it still pending**,
    builds the child via `buildOfferPayload(..., parentOfferId)` (parent `offer_id`,
    falling back to the parent message id for legacy offers), then supersedes the
    parent with `counter_offer_id` set to the child's `offer_id` — all synchronous, no
    longer dependent on the insert returning.
  - Offer card: negotiation stepper, `↩ counter to offer N` / `↓ continued by offer
    N+1` flow links, superseded chip/status-line. Response buttons already only show
    on the single pending offer.
- **`src/styles/chat-thread.css`** — stepper dots with connector lines, past/current/
  future states, superseded chip + status-line colors (neutral gray), down-flow tag
  variant.

## Not broken
- Phase 1 sending + Phase 2 Accept/Decline/Counter UX, decline confirm, list previews,
  `Offers` filter, emoji picker, mobile layout; text/image/video/audio/file/deal/call
  messages; legacy Phase-1/2 offer payloads render identically (offer_id falls back to
  message id for linking/steppers).

## Verification
- `npx eslint src/utils/offerMessage.js` → clean.
- `npx eslint src/pages/Chat.jsx` → 12 problems (8 errors, 4 warnings) — identical
  pre-existing baseline; zero from the new code.
- `npm run build` → **passes** (`✓ built in 2.87s`).
- Manual logic review: multi-step chains (buyer→seller→buyer), single active offer,
  supersede-on-counter, legacy payload linking, stepper rendering.

---

# Phase 4 — Offer Management

Task source: `docs/claudehelp.md` — let buyers manage their offers (Withdraw, Edit
before the seller responds, Duplicate a previous offer), expired offers become
read-only, and add **Withdrawn** / **Expired** statuses.

## Statuses (extended vocabulary)
`pending · accepted · declined · superseded · withdrawn · expired`
- **Withdrawn** — persisted. Buyer withdraws their own pending offer → terminal +
  read-only. The seller sees "Buyer withdrew this offer" and the response buttons
  disappear.
- **Expired** — computed client-side, no cron/migration. A `pending` offer whose
  `created_at` is older than `OFFER_EXPIRY_MS` (72h) renders as **Expired**
  (read-only) on both sides from the same timestamp + wall clock. The card's display
  status is an *effective status*: `expired` wins over `pending` for chip, status
  line, and every action gate.
- Legacy `countered` still renders as Superseded.

## Buyer actions (shown only on the buyer's own offers, `isMine`)
- **Edit** — only while `pending` and not expired. Opens the existing offer sheet
  prefilled (Edit mode); saving updates the **same message row** (`body` amount/note,
  plus `edited_at` so the "edited" badge shows). `offer_id`, `parent_offer_id`,
  `created_at` and `status` are preserved, so the negotiation chain and expiry history
  stay intact and the seller can still respond to the edited amount.
- **Withdraw** — only while `pending` and not expired. Two-step inline confirm
  (`Withdraw` → `Confirm withdraw` / `Cancel`), then status → `withdrawn`
  (optimistic + DB). Terminal and read-only afterwards.
- **Duplicate** — available on any of the buyer's own offers (including
  declined/withdrawn/expired/superseded). Opens the sheet prefilled with that offer's
  amount/note in **new-offer** mode (no `parent_offer_id`) so it becomes a fresh
  pending offer / negotiation — never mutates the source offer.

## Read-only rules
- Seller response buttons (Accept/Decline/Counter) require `pending` **and** not
  expired — expired and withdrawn offers are inert.
- Buyer Edit/Withdraw require `pending` and not expired. Duplicate is the only
  action that stays available on read-only offers (it creates a new offer).

## Files changed
- **`src/utils/offerMessage.js`** — `OFFER_STATUS.withdrawn` + `expired`, labels, and
  `offerStatusText` cases ("You withdrew this offer" / "Buyer withdrew this offer" /
  "Your offer expired" / "This offer expired"); `OFFER_EXPIRY_MS` + `isOfferExpired`.
- **`src/pages/Chat.jsx`**
  - State: `editOfferMsg`, `withdrawConfirmId`.
  - `sendOffer` now branches on three modes: **Edit** (update same message),
    **Counter** (new offer + supersede parent), **New/Duplicate** (fresh offer). New
    `sendOfferMessage(payload)` + `closeOfferSheet()` helpers.
  - `openEditOffer`, `duplicateOffer`, `onWithdrawClick` (two-step), `withdrawOffer`.
  - Card: effective status (`expired` wins), chip/status-line use it; `canRespond`
    and buyer Edit/Withdraw gated on pending + not expired; new `is-manage` action row
    (Edit / Withdraw→Confirm / Duplicate). Sheet head, aria-label, and send-button
    label adapt to Edit mode; all close paths reset the sheet state.
- **`src/styles/chat-thread.css`** — withdrawn (amber) and expired (gray) chip +
  status-line colors, and the management action row (equal-width fit on one line).

## Not broken
- Phases 1–3: sending, Accept/Decline/Counter, decline confirm, negotiation chain +
  stepper, supersede-on-counter, offer sheet, list previews, `Offers` filter, emoji
  picker, mobile layout; all other message types; legacy payloads.

## Verification
- `npx eslint src/utils/offerMessage.js` → clean.
- `npx eslint src/pages/Chat.jsx` → 12 problems (8 errors, 4 warnings) — identical
  pre-existing baseline; zero from the new code.
- `npm run build` → **passes** (`✓ built in 4.35s`).
- Manual logic review: edit-before-response, withdraw confirm + read-only, duplicate
  as fresh offer, expired gating (canRespond false, edit/withdraw hidden), status
  labels/text for both sides.