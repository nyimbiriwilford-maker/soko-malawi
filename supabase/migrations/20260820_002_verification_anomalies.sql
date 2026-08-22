-- ============================================================
-- 20260820_002_verification_anomalies.sql
-- Multi-source anomaly log for the verification pipeline:
--   • client reporter (best-effort, rate-limited)
--   • edge function errors (verify-transaction)
--   • DB-side admin scan (stuck reviews, payment desync, overdue info, badge drift)
-- Idempotent. Apply after 20260820_001_verification_issues.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) verification_anomalies
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'client' CHECK (source IN ('client','edge','db')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error','critical')),
  category text NOT NULL,
  message text NOT NULL,
  request_id uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_hash text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acked','resolved','ignored')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_anomalies_status_created
  ON public.verification_anomalies (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_anomalies_request
  ON public.verification_anomalies (request_id, created_at DESC)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.verification_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_anomalies_admin_select" ON public.verification_anomalies;
CREATE POLICY "verification_anomalies_admin_select" ON public.verification_anomalies
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "verification_anomalies_admin_update" ON public.verification_anomalies;
CREATE POLICY "verification_anomalies_admin_update" ON public.verification_anomalies
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Inserts only through RPCs (no client INSERT policy).

-- ────────────────────────────────────────────────────────────
-- 2) RPC: report_verification_anomaly (authenticated; rate-limited + deduped)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_verification_anomaly(
  p_source text,
  p_severity text,
  p_category text,
  p_message text,
  p_request_id uuid DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_category text;
  v_message text;
  v_context jsonb;
  v_hash text;
  v_recent integer;
  v_dup uuid;
  v_result uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Sources: only 'client' may be reported by users; edge/db are RPC/service-role channels
  -- from service-role contexts (auth.uid() NULL) — those are allowed; users may only claim 'client'.
  v_category := COALESCE(NULLIF(trim(p_category), ''), 'unknown') ;
  IF length(v_category) > 120 THEN v_category := left(v_category, 120); END IF;
  v_message := COALESCE(NULLIF(trim(p_message), ''), 'No message');
  IF length(v_message) > 2048 THEN v_message := left(v_message, 2048); END IF;

  v_context := COALESCE(p_context, '{}'::jsonb);
  IF length(v_context::text) > 8192 THEN
    v_context := jsonb_build_object('truncated', true, 'error', left(v_context::text, 7000));
  END IF;

  v_hash := md5(coalesce(p_source,'client') || '|' || v_category || '|' || v_message || '|' || coalesce(p_request_id::text, ''));

  -- Rate limit: max 10 reports per user per 5 minutes (self-reported or admin)
  SELECT count(*) INTO v_recent
  FROM public.verification_anomalies
  WHERE created_by = v_uid AND created_at > now() - interval '5 minutes';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Anomaly report rate limit reached';
  END IF;

  -- Dedupe: same hash still open (or created within last 10 minutes) → skip
  SELECT id INTO v_dup
  FROM public.verification_anomalies
  WHERE dedupe_hash = v_hash
    AND (status IN ('open','acked') OR created_at > now() - interval '10 minutes')
  LIMIT 1;
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;

  INSERT INTO public.verification_anomalies (
    source, severity, category, message, request_id, seller_id,
    context, dedupe_hash, created_by
  ) VALUES (
    CASE WHEN p_source IN ('client','edge','db') THEN p_source ELSE 'client' END,
    CASE WHEN p_severity IN ('info','warning','error','critical') THEN p_severity ELSE 'warning' END,
    v_category, v_message, p_request_id, p_seller_id,
    v_context, v_hash, v_uid
  )
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_verification_anomaly(text, text, text, text, uuid, uuid, jsonb) TO authenticated;
COMMENT ON FUNCTION public.report_verification_anomaly IS
  'Best-effort anomaly reporter: rate-limited (10/5min), deduplicated, truncates message/context.';

-- ────────────────────────────────────────────────────────────
-- 3) RPC: admin_scan_verification_anomalies (on-demand SLA/stuck scan)
--    Categories: stuck_in_review, payment_desync, resolved_info_overdue,
--    approved_without_sync
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_scan_verification_anomalies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_review_hours integer := 24;
  v_inserted integer := 0;
  v_hash text;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT COALESCE(review_period_hours, 24) INTO v_review_hours
    FROM public.verification_settings WHERE id = 1;
  IF v_review_hours IS NULL OR v_review_hours <= 0 THEN v_review_hours := 24; END IF;

  -- a) stuck_in_review: under_review beyond review window
  FOR r IN
    SELECT req.id, req.seller_id
    FROM public.verification_requests req
    WHERE req.status = 'under_review'
      AND COALESCE(req.under_review_at, req.updated_at) < now() - (v_review_hours || ' hours')::interval
      AND req.created_at > now() - interval '180 days'
  LOOP
    v_hash := md5('db|stuck_in_review|' || r.id::text);
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_anomalies
      WHERE dedupe_hash = v_hash AND status IN ('open','acked')
    ) THEN
      INSERT INTO public.verification_anomalies (source, severity, category, message, request_id, seller_id, dedupe_hash, created_by)
      VALUES ('db', 'warning', 'stuck_in_review',
        'Request has been under review for longer than the configured review window.',
        r.id, r.seller_id, v_hash, v_uid);
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- b) payment_desync: payment_pending for long with no non-terminal payment row
  FOR r IN
    SELECT req.id, req.seller_id
    FROM public.verification_requests req
    WHERE req.status = 'payment_pending'
      AND req.updated_at < now() - interval '6 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.verification_payments p
        WHERE p.request_id = req.id
          AND p.payment_status IN ('pending','initiated','awaiting_confirmation','confirmed')
      )
      AND req.created_at > now() - interval '180 days'
  LOOP
    v_hash := md5('db|payment_desync|' || r.id::text);
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_anomalies
      WHERE dedupe_hash = v_hash AND status IN ('open','acked')
    ) THEN
      INSERT INTO public.verification_anomalies (source, severity, category, message, request_id, seller_id, dedupe_hash, created_by)
      VALUES ('db', 'warning', 'payment_desync',
        'Payment pending but no active payment row found — payment may have been lost.',
        r.id, r.seller_id, v_hash, v_uid);
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- c) resolved_info_overdue: additional_info_required past deadline with no resubmit
  --    (NULL deadline = no deadline set → skip)
  FOR r IN
    SELECT req.id, req.seller_id
    FROM public.verification_requests req
    WHERE req.status = 'additional_info_required'
      AND req.additional_info_deadline_at IS NOT NULL
      AND req.additional_info_deadline_at < now()
      AND NOT EXISTS (
        SELECT 1 FROM public.verification_status_events ev
        WHERE ev.request_id = req.id
          AND ev.to_status = 'under_review'
          AND ev.created_at > req.additional_info_deadline_at
      )
      AND req.created_at > now() - interval '180 days'
  LOOP
    v_hash := md5('db|resolved_info_overdue|' || r.id::text);
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_anomalies
      WHERE dedupe_hash = v_hash AND status IN ('open','acked')
    ) THEN
      INSERT INTO public.verification_anomalies (source, severity, category, message, request_id, seller_id, dedupe_hash, created_by)
      VALUES ('db', 'info', 'resolved_info_overdue',
        'Seller has not resubmitted after the additional-info deadline passed.',
        r.id, r.seller_id, v_hash, v_uid);
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- d) approved_without_sync: approved request but profile badge not synced
  FOR r IN
    SELECT req.id, req.seller_id
    FROM public.verification_requests req
    JOIN public.profiles pr ON pr.id = req.seller_id
    WHERE req.status = 'approved'
      AND COALESCE(pr.is_verified, false) = false
      AND req.created_at > now() - interval '180 days'
  LOOP
    v_hash := md5('db|approved_without_sync|' || r.id::text);
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_anomalies
      WHERE dedupe_hash = v_hash AND status IN ('open','acked')
    ) THEN
      INSERT INTO public.verification_anomalies (source, severity, category, message, request_id, seller_id, dedupe_hash, created_by)
      VALUES ('db', 'error', 'approved_without_sync',
        'Request is approved but the seller profile badge is not active (badge drift).',
        r.id, r.seller_id, v_hash, v_uid);
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_scan_verification_anomalies() TO authenticated;
COMMENT ON FUNCTION public.admin_scan_verification_anomalies IS
  'On-demand anomaly scan: stuck reviews, payment desync, overdue info, badge drift. No pg_cron.';

-- ────────────────────────────────────────────────────────────
-- 4) RPC: admin_update_verification_anomaly
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_verification_anomaly(
  p_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS public.verification_anomalies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_anomalies;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_status NOT IN ('open','acked','resolved','ignored') THEN
    RAISE EXCEPTION 'Invalid anomaly status: %', p_status;
  END IF;

  UPDATE public.verification_anomalies SET
    status = p_status,
    resolved_at = CASE WHEN p_status IN ('resolved','ignored') THEN now() ELSE NULL END,
    resolved_by = CASE WHEN p_status IN ('resolved','ignored') THEN v_uid ELSE NULL END,
    context = CASE
      WHEN NULLIF(trim(p_note), '') IS NOT NULL
        THEN context || jsonb_build_object('admin_note', trim(p_note))
      ELSE context
    END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Anomaly not found'; END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_verification_anomaly(uuid, text, text) TO authenticated;
