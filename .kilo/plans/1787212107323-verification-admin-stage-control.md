# Verification Pipeline: Admin Stage Control, Error-Resolution Catalog, Anomaly Logging & Optimization

## Context
SokoMW already has a production verification pipeline: `verification_requests` state machine via `transition_verification_status` RPC, staged admin review UI (`AdminVerificationHub`, `AdminVerificationDetail`), seller `VerificationWizard`, PayChangu payment reconciliation (`verify-transaction` edge fn), and `verification_status_events` / `verification_admin_audit` audit trails. Real failures (`docs/console.md`) surface only in browser console — nothing is captured for developers.

**Decisions (user-confirmed):**
1. Target = extend the **existing seller/shop/business verification pipeline** (not a new system).
2. Granularity = **stage-level control + justified override action** (not per-document review this round).
3. Error resolution = **structured issue catalog** (`verification_issues` + curated suggestions shown to the seller).
4. Bug logging = **multi-source anomaly table** (client reporter + edge-function errors + DB-side SLA/stuck detection), with a developer-review admin tab.

## State Machine (formalized — no status renames)

Stages (groups of the existing 10 statuses):

| Stage | Statuses | Entry condition |
|---|---|---|
| Intake | `draft` | wizard autosave / `ensureVerificationDraft` |
| Payment | `payment_pending`, `payment_confirmed` | checkout started / gateway or admin confirm |
| Queue | `submitted` | seller submit (docs required) |
| Review | `under_review` | admin pickup OR `auto_submit_on_payment` |
| Resolution | `additional_info_required` | admin flags issues / requests info (gets `additional_info_deadline_at`) |
| Decision (terminal) | `approved`, `rejected`, `expired`, `cancelled` | admin decision / expiry |

**Admin stage-action matrix** (single source of truth; new `ADMIN_STAGE_ACTIONS` map in `src/lib/verification.js`):

| Stage | normal actions | override available |
|---|---|---|
| draft | cancel on behalf, move→under_review | to any open stage |
| payment_* | confirm/reject payment, move→under_review | to any open stage |
| submitted | pickup→under_review, reject, request info | to any open stage |
| under_review | approve, reject, request info, flag issues | to any open stage |
| additional_info_required | approve (waive remaining issues), reject, **extend deadline**, clear/waive individual issues | reopen to review, any open stage |
| approved/rejected/expired/cancelled | — | **reopen to any open stage** (justification required) |

Every override action: mandatory justification text, allowed transitions validated server-side, always audited.

## Ordered Tasks

### 1. Migration `supabase/migrations/20260820_001_verification_issues.sql`
- `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS additional_info_deadline_at timestamptz` (set by transition RPC when entering `additional_info_required`: `now() + additional_info_deadline_days`).
- `verification_issue_catalog(id, code UNIQUE, label, default_suggested_fix, default_next_action, applies_to_types text[], is_active, sort_order)` — seed ~10 curated categories: `id_blurry`, `id_expired`, `name_mismatch`, `selfie_mismatch`, `doc_missing_page`, `receipt_unreadable`, `payment_wrong_amount`, `payment_wrong_reference`, `business_doc_expired`, `other`.
- `verification_issues(id, request_id, doc_id NULL, category_code, note NULL, suggested_fix, next_action, flagged_by, status open|needs_recheck|resolved|waived, flagged_at, resolved_at, resolved_by, meta jsonb)` + RLS (seller reads own open issues; admin full; no seller update).
- RPCs (SECURITY DEFINER): `admin_flag_verification_issues(p_request_id, p_issues jsonb[], p_message text)` — flags batch, auto-transitions request → `additional_info_required` (sets deadline + `additional_info_message`), notifies seller; `admin_resolve_verification_issue(p_issue_id, p_status, p_note)`; `resolve_open_issues_for_request(p_request_id, p_status)` (waive-on-approve helper).
- Extend `transition_verification_status` (CREATE OR REPLACE): on seller submit from `additional_info_required`, mark open issues `needs_recheck`; on `approved`/`rejected`/`cancelled` set remaining open issues `resolved`.

### 2. Migration `supabase/migrations/20260820_002_verification_anomalies.sql`
- `verification_anomalies(id, source client|edge|db, severity info|warning|error|critical, category, message, request_id NULL, seller_id NULL, context jsonb, dedupe_hash, status open|acked|resolved|ignored, created_by NULL, resolved_by NULL, resolved_at, created_at)` + index on `(status, created_at DESC)`.
- RLS: insert only via RPC; read/update admin-only.
- RPC `report_verification_anomaly(p_source, p_severity, p_category, p_message, p_request_id, p_seller_id, p_context)`: authenticated insert, rate-limited (≤ 10 inserts / 5 min per user), dedupes on `md5(category||message||coalesce(request_id))` within same result window → skip, truncates `message` to 2 KB / `context` to 8 KB.
- RPC `admin_scan_verification_anomalies()` — SECURITY DEFINER; inserts anomalies for:
  - `stuck_in_review`: `under_review` older than `settings.review_period_hours`;
  - `payment_desync`: `payment_pending` > 6 h with no non-terminal `verification_payments` row;
  - `resolved_info_overdue`: `additional_info_required` past `additional_info_deadline_at` with no resubmit event;
  - `approved_without_sync`: `approved` request whose `profiles.is_verified` is false (badge drift);
  dedupes via `dedupe_hash` per open status.
- Admin RPCs: `admin_update_verification_anomaly(p_id, p_status, p_note)`.

### 3. Migration `supabase/migrations/20260820_003_verification_admin_override.sql`
- RPC `admin_override_verification_status(p_request_id, p_to_status, p_justification)`: admin-only; allows **any** transition (including reopening terminal statuses); validates target is one of the 10 statuses; requires non-empty justification; writes `verification_admin_audit(action='override_status')`; records `meta.override = {admin_id, at, justification}`; writes `verification_status_events` with note; rejects quietly if justification blank.

### 4. `src/lib/verification.js` — helpers (no renames; additive only)
- `ADMIN_STAGE_ACTIONS` map (stage → allowed action keys) + `stageOfStatus(status)` helper.
- `adminFlagIssues(requestId, issues, message)`, `getIssuesForRequest(requestId)`, `adminResolveIssue(...)`.
- `reportVerificationAnomaly({ category, message, requestId, context })` — try/catch wrapping the RPC, best-effort, throttled client-side (1 per category per 60 s via module var).
- `adminOverrideStatus(requestId, toStatus, justification)`; `adminScanAnomalies()`; `getVerificationAnomalies({status, limit})`; `adminUpdateAnomaly(id, status, note)`.
- Wire `reportVerificationAnomaly` into existing catch sites: `reconcileVerificationPayment` non-confirm/error paths, `submitVerificationApplication` failures, `getAdminVerificationDetail` load failures.

### 5. Edge function `supabase/functions/verify-transaction/index.ts`
- Wrap main handler: on caught errors and on gateway HTTP/timeout failures, insert into `verification_anomalies` via service-role client (source `'edge'`, severity `'error'`, context: tx_ref, gateway status code, error message). Non-blocking (never changes the response contract).

### 6. Seller surface — `VerificationWizard.jsx`
- Status step (`additional_info_required` branch): replace plain `additional_info_message` render with a **structured issues checklist** loaded via `getIssuesForRequest`: each issue = category label, deadline badge, `suggested_fix` (what's wrong), `next_action` (what to do), resolved/needs-recheck states. Falls back to current message when no issues exist (progressive, per repo convention).
- Resubmit path unchanged (`submitVerificationApplication`) — backend flips issues to `needs_recheck`.

### 7. Admin surface
- `AdminVerificationDetail.jsx` (1,295 lines — surgical edits only):
  - New **Issues panel**: multi-select from active catalog (label preview), per-issue editable suggested-fix before sending, "Flag issues & notify" → `adminFlagIssues`; when issues exist, list them with resolve/waive buttons; "extend deadline +3 days" button for `additional_info_required`.
  - New **Override** action (all stages incl. terminal): opens modal → target stage picker (from `ADMIN_STAGE_ACTIONS`-permitted set) + mandatory justification textarea → `adminOverrideStatus`; disabled button state if justification empty.
  - Replaces the `window.prompt` payment-reject path and `window.confirm` approve/reject dialogs with inline confirm rows where those exist (they do: approve confirm + reject prompt at lines ~130-190).
  - Related-anomalies strip: if the request has open anomalies, show count + link to Anomalies tab.
- `src/components/AdminVerificationAnomalies.jsx` (new): developer-review tab — filters (status, severity, source), table with expandable `context` JSON, actions Take/Resolve/Ignore, "Run scan" button calling `admin_scan_verification_anomalies` (throttled server-side by dedupe hash anyway), CSV export of open items.
- `Admin.jsx`: add `'Anomalies'` to `TABS`, badge count = open anomalies, deep-link `/admin?tab=Anomalies`; run `adminScanAnomalies()` lazily when Verifications tab opens (module-level last-scan throttle ≥ 5 min).
- Realtime: `AdminVerificationHub` subscribe `postgres_changes` on `verification_requests` + `verification_payments` (INSERT/UPDATE, admin-scoped) to refresh queue without reload.
- `AdminVerificationSettings.jsx`: add **Issue Catalog** management section (list/add/deactivate catalog entries, edit default suggested-fix + next-action) — writes to `verification_issue_catalog`.

### 8. Optimization details (Requirement 4)
- Hub queue: compute & display "Overdue" chip from `under_review_at`/`payment_confirmed_at`/`additional_info_deadline_at` vs settings; sort overdue first (pure UI, uses existing data).
- Detail prefetch: fetch `getAdminVerificationDetail` on row hover/click-start to hide latency (show skeleton inside existing drawer shell).
- Client anomaly reporter throttled; anomaly RPC rate-limited & deduped server-side (Task 2) so no log spam.
- No pg_cron dependency anywhere — scanning is on-demand (admin button / tab-open trigger), matching Supabase plan constraints.

## Out of Scope (explicit)
- Per-document approval/rejection granularity (decision deferred — issues can reference `doc_id` for future expansion).
- Buyer/account-level verification — this pipeline is seller/shop/business only.
- Fraud/AI document checks, email delivery of issue notices (in-app `notifications` row only, existing channel).
- Rewriting `transition_verification_status` core semantics beyond the issue-hook extension.

## Failure Modes & Guards
- **Override abuse:** justification mandatory + target status validated in SQL; every override lands in `verification_admin_audit` + `verification_status_events`.
- **Anomaly insert abuse:** RPC rate limit + dedupe hash; RLS allows insert only via RPC; `context` truncated.
- **Tables not deployed yet:** all React helpers follow the repo's progressive-fallback convention (try RPC → fall back gracefully → silent no-op), so UI degrades without breaking.
- **Deadline backfill:** existing `additional_info_required` rows have NULL `additional_info_deadline_at`; scan treats NULL as "no deadline set" (skip overdue detection), migration does NOT retro-set deadlines.
- **Payment override:** override can move a request out of payment stages; UI shows a warning block ("prefer Confirm payment action") but does not block — documented as admin discretion in the override modal copy.

## Validation
1. `npm run build` — must pass.
2. `npx eslint src/lib/verification.js src/components/AdminVerificationDetail.jsx src/components/AdminVerificationAnomalies.jsx src/components/VerificationWizard.jsx src/pages/Admin.jsx` — no new errors vs baseline.
3. Apply the 3 migrations in Supabase; smoke-test via SQL editor: flag→resubmit→waive cycle, override reopen with justification, `admin_scan_verification_anomalies()` returns expected categories on seeded rows, `report_verification_anomaly` rate-limit denial.
4. Greps: no `alert(` / `window.prompt(` added; no new emoji-as-icons in admin detail.
5. Manual walkthrough: seller wizard → submit → admin flags 2 catalog issues → seller sees checklist with fixes + deadline → resubmits (issues → needs_recheck) → admin approves with waiver → anomalies tab shows a stuck-review scan hit.
6. Per `AGENTS.md`: append implementation summary to `docs/response.dm`.

## Open Questions
None — scope, granularity, issue-catalog structure, anomaly sources, and optimization approach all confirmed. Hand off for implementation.
