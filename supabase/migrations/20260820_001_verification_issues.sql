-- ============================================================
-- 20260820_001_verification_issues.sql
-- Structured issue catalog for verification review.
-- Admin flags curated issues → seller gets deadline + checklist;
-- resubmit flips issues to needs_recheck; terminal statuses resolve them.
-- Idempotent. Apply after 20260716_verification_additional_info_flow.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) verification_requests — deadline column for additional info
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS additional_info_deadline_at timestamptz;

COMMENT ON COLUMN public.verification_requests.additional_info_deadline_at IS
  'Seller deadline to resubmit after admin requests more info. NULL = no deadline set.';

-- ────────────────────────────────────────────────────────────
-- 2) verification_issue_catalog — curated issue categories
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_issue_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  default_suggested_fix text,
  default_next_action text,
  applies_to_types text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.verification_issue_catalog (code, label, default_suggested_fix, default_next_action, applies_to_types, sort_order)
VALUES
  ('id_blurry', 'ID document is blurry',
   'The national ID / passport photo is not readable.',
   'Re-upload a clearer, well-lit photo of your ID.',
   '{}', 10),
  ('id_expired', 'ID document is expired',
   'The uploaded ID has passed its expiry date.',
   'Upload a valid (non-expired) ID document.',
   '{}', 20),
  ('name_mismatch', 'Name does not match ID',
   'The profile/shop name does not match the name on the ID.',
   'Update your profile name to match your ID, or re-upload the correct ID.',
   '{}', 30),
  ('selfie_mismatch', 'Selfie does not match ID',
   'The selfie does not clearly match the person on the ID.',
   'Upload a new selfie holding your ID beside your face.',
   ARRAY['seller','shop'], 40),
  ('doc_missing_page', 'Document page is missing',
   'A required page of the document was not uploaded.',
   'Upload the missing page(s) of the document.',
   ARRAY['business','shop'], 50),
  ('receipt_unreadable', 'Payment receipt is unreadable',
   'The uploaded payment receipt cannot be verified.',
   'Re-upload a clear screenshot or photo of the payment receipt.',
   '{}', 60),
  ('payment_wrong_amount', 'Payment amount is incorrect',
   'The amount paid does not match the verification fee.',
   'Pay the correct fee and upload the new receipt.',
   '{}', 70),
  ('payment_wrong_reference', 'Payment reference is wrong',
   'The payment reference does not match your account.',
   'Contact support with your correct payment reference.',
   '{}', 80),
  ('business_doc_expired', 'Business document is expired',
   'The business registration document is expired.',
   'Upload a current business registration document.',
   ARRAY['business','shop'], 90),
  ('other', 'Other issue',
   'There is a problem with your application.',
   'Review your application details and resubmit.',
   '{}', 100)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_verification_issue_catalog_active
  ON public.verification_issue_catalog (sort_order) WHERE is_active;

ALTER TABLE public.verification_issue_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_issue_catalog_select" ON public.verification_issue_catalog;
CREATE POLICY "verification_issue_catalog_select" ON public.verification_issue_catalog
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "verification_issue_catalog_admin_insert" ON public.verification_issue_catalog;
CREATE POLICY "verification_issue_catalog_admin_insert" ON public.verification_issue_catalog
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "verification_issue_catalog_admin_update" ON public.verification_issue_catalog;
CREATE POLICY "verification_issue_catalog_admin_update" ON public.verification_issue_catalog
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- No direct deletes (deactivate instead); no DELETE policy.

-- ────────────────────────────────────────────────────────────
-- 3) verification_issues — flagged issues per request
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  doc_id uuid REFERENCES public.verification_documents(id) ON DELETE SET NULL,
  category_code text NOT NULL DEFAULT 'other',
  note text,
  suggested_fix text,
  next_action text,
  flagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','needs_recheck','resolved','waived')),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_verification_issues_request
  ON public.verification_issues (request_id, status, flagged_at);
CREATE INDEX IF NOT EXISTS idx_verification_issues_open
  ON public.verification_issues (status, flagged_at DESC)
  WHERE status IN ('open','needs_recheck');

ALTER TABLE public.verification_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_issues_select" ON public.verification_issues;
CREATE POLICY "verification_issues_select" ON public.verification_issues
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.verification_requests r
      WHERE r.id = request_id AND r.seller_id = auth.uid()
    )
  );

-- No direct client insert/update/delete — admin RPCs only.

-- ────────────────────────────────────────────────────────────
-- 4) RPC: admin_flag_verification_issues
--    Flags batch, auto-transitions to additional_info_required,
--    sets deadline + message, notifies seller, audits.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_flag_verification_issues(
  p_request_id uuid,
  p_issues jsonb[] DEFAULT '{}',
  p_message text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_requests;
  v_item jsonb;
  v_code text;
  v_cat public.verification_issue_catalog;
  v_count integer := 0;
  v_deadline_days integer;
  v_message text;
  v_labels text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT * INTO v_row FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT COALESCE(additional_info_deadline_days, 7) INTO v_deadline_days
    FROM public.verification_settings WHERE id = 1;
  IF v_deadline_days IS NULL OR v_deadline_days <= 0 THEN v_deadline_days := 7; END IF;

  -- Insert each issue
  IF p_issues IS NOT NULL THEN
    FOREACH v_item IN ARRAY p_issues LOOP
      v_code := NULLIF(trim(COALESCE(v_item->>'category_code', '')), '');
      IF v_code IS NULL THEN v_code := 'other'; END IF;

      SELECT * INTO v_cat FROM public.verification_issue_catalog WHERE code = v_code AND is_active;
      IF NOT FOUND THEN
        SELECT * INTO v_cat FROM public.verification_issue_catalog WHERE code = 'other';
      END IF;

      INSERT INTO public.verification_issues (
        request_id, doc_id, category_code, note, suggested_fix, next_action, flagged_by, status
      ) VALUES (
        p_request_id,
        (v_item->>'doc_id')::uuid,
        v_cat.code,
        NULLIF(trim(COALESCE(v_item->>'note', '')), ''),
        COALESCE(NULLIF(trim(v_item->>'suggested_fix'), ''), v_cat.default_suggested_fix),
        COALESCE(NULLIF(trim(v_item->>'next_action'), ''), v_cat.default_next_action),
        v_uid,
        'open'
      );

      v_count := v_count + 1;
      v_labels := array_append(v_labels, v_cat.label);
    END LOOP;
  END IF;

  -- Auto-build seller message from issue labels when none provided
  v_message := NULLIF(trim(COALESCE(p_message, '')), '');
  IF v_message IS NULL AND array_length(v_labels, 1) > 0 THEN
    v_message := 'Please fix the following: ' || array_to_string(v_labels, '; ');
  END IF;

  -- Transition request → additional_info_required (validates + logs event via trigger)
  UPDATE public.verification_requests SET
    status = 'additional_info_required',
    additional_info_message = COALESCE(v_message, additional_info_message,
      'Please provide additional information to continue verification.'),
    additional_info_deadline_at = now() + (v_deadline_days || ' days')::interval,
    reviewed_by = v_uid,
    updated_at = now()
  WHERE id = p_request_id;
  -- (Status change event is logged automatically by the status-log trigger.)

  -- Audit trail
  INSERT INTO public.verification_admin_audit (admin_id, action, entity_type, entity_id, note, meta)
  VALUES (v_uid, 'flag_issues', 'verification_request', p_request_id::text,
    v_message, jsonb_build_object('issue_count', v_count));

  -- Notify seller (best effort — must not fail flagging)
  BEGIN
    IF to_regproc('public.notify_user') IS NOT NULL THEN
      PERFORM public.notify_user(
        v_row.seller_id,
        'verification_additional_info',
        'Additional information required',
        COALESCE(v_message, 'Please review your verification application and resubmit.'),
        '/profile?verify=1',
        jsonb_build_object('request_id', p_request_id, 'kind', 'verification_additional_info', 'open_verify', true)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notify_user failed: %', SQLERRM;
  END;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_flag_verification_issues(uuid, jsonb[], text) TO authenticated;
COMMENT ON FUNCTION public.admin_flag_verification_issues IS
  'Admin: flag curated issues on a request; auto-requests additional info with deadline and notifies seller.';

-- ────────────────────────────────────────────────────────────
-- 5) RPC: admin_resolve_verification_issue
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_verification_issue(
  p_issue_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS public.verification_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_issues;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_status NOT IN ('open','needs_recheck','resolved','waived') THEN
    RAISE EXCEPTION 'Invalid issue status: %', p_status;
  END IF;

  UPDATE public.verification_issues SET
    status = p_status,
    resolved_at = CASE WHEN p_status IN ('resolved','waived') THEN now() ELSE NULL END,
    resolved_by = CASE WHEN p_status IN ('resolved','waived') THEN v_uid ELSE NULL END,
    meta = CASE
      WHEN NULLIF(trim(p_note), '') IS NOT NULL
        THEN meta || jsonb_build_object('resolution_note', trim(p_note))
      ELSE meta
    END
  WHERE id = p_issue_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_verification_issue(uuid, text, text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6) RPC: resolve_open_issues_for_request (waive-on-approve helper)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_open_issues_for_request(
  p_request_id uuid,
  p_status text DEFAULT 'resolved'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cnt integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_status NOT IN ('resolved','waived') THEN
    RAISE EXCEPTION 'Invalid issue status: %', p_status;
  END IF;

  UPDATE public.verification_issues SET
    status = p_status,
    resolved_at = now(),
    resolved_by = v_uid
  WHERE request_id = p_request_id AND status IN ('open','needs_recheck');

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_open_issues_for_request(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7) RPC: get_verification_issues (seller-own or admin)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_verification_issues(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  request_id uuid,
  doc_id uuid,
  category_code text,
  label text,
  note text,
  suggested_fix text,
  next_action text,
  status text,
  flagged_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seller uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT seller_id INTO v_seller FROM public.verification_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_seller <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT vi.id, vi.request_id, vi.doc_id, vi.category_code,
    COALESCE(c.label, initcap(replace(vi.category_code, '_', ' '))),
    vi.note, vi.suggested_fix, vi.next_action, vi.status, vi.flagged_at, vi.resolved_at
  FROM public.verification_issues vi
  LEFT JOIN public.verification_issue_catalog c ON c.code = vi.category_code
  WHERE vi.request_id = p_request_id
  ORDER BY vi.flagged_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_verification_issues(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 8) Extend transition_verification_status (same signature, additive hooks):
--    • resubmit from additional_info_required → open issues become needs_recheck
--    • terminal statuses resolve remaining open issues
--    • entering additional_info_required sets the deadline
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transition_verification_status(
  p_request_id uuid,
  p_to_status text,
  p_note text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_additional_info_message text DEFAULT NULL
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.verification_requests;
  v_uid uuid := auth.uid();
  v_from_status text;
  v_deadline_days integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_to_status NOT IN (
    'draft','submitted','payment_pending','payment_confirmed','under_review',
    'additional_info_required','approved','rejected','expired','cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid status: %', p_to_status;
  END IF;

  SELECT * INTO v_row FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  v_from_status := v_row.status;

  IF v_row.seller_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Sellers: limited transitions only
  IF NOT public.is_admin() THEN
    IF p_to_status = 'cancelled' AND v_row.status IN (
      'draft','submitted','payment_pending','additional_info_required'
    ) THEN
      NULL;
    ELSIF p_to_status = 'submitted' AND v_row.status IN ('draft', 'additional_info_required') THEN
      NULL;
    -- Resubmit after additional info: back into review queue
    ELSIF p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN
      NULL;
    ELSIF p_to_status = 'payment_pending' AND v_row.status IN ('draft', 'submitted') THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Sellers cannot set status %', p_to_status;
    END IF;
  END IF;

  SELECT COALESCE(additional_info_deadline_days, 7) INTO v_deadline_days
    FROM public.verification_settings WHERE id = 1;
  IF v_deadline_days IS NULL OR v_deadline_days <= 0 THEN v_deadline_days := 7; END IF;

  UPDATE public.verification_requests SET
    status = p_to_status,
    admin_note = CASE WHEN public.is_admin() AND p_note IS NOT NULL THEN p_note ELSE admin_note END,
    rejection_reason = CASE
      WHEN p_to_status = 'rejected' THEN COALESCE(p_rejection_reason, p_note, rejection_reason)
      ELSE rejection_reason
    END,
    additional_info_message = CASE
      WHEN p_to_status = 'additional_info_required'
        THEN COALESCE(p_additional_info_message, p_note, additional_info_message)
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required'
        THEN additional_info_message -- keep last admin message for history
      ELSE additional_info_message
    END,
    additional_info_deadline_at = CASE
      WHEN p_to_status = 'additional_info_required'
        THEN now() + (v_deadline_days || ' days')::interval
      ELSE additional_info_deadline_at
    END,
    reviewed_by = CASE
      WHEN p_to_status IN ('approved','rejected','additional_info_required','under_review')
        AND public.is_admin() THEN v_uid
      ELSE reviewed_by
    END,
    reviewed_at = CASE
      WHEN p_to_status IN ('approved','rejected') THEN now()
      ELSE reviewed_at
    END,
    submitted_at = CASE
      WHEN p_to_status IN ('submitted', 'under_review') AND submitted_at IS NULL THEN now()
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN now()
      ELSE submitted_at
    END,
    payment_confirmed_at = CASE
      WHEN p_to_status = 'payment_confirmed' THEN COALESCE(payment_confirmed_at, now())
      ELSE payment_confirmed_at
    END,
    under_review_at = CASE
      WHEN p_to_status = 'under_review' THEN now()
      ELSE under_review_at
    END,
    cancelled_at = CASE
      WHEN p_to_status = 'cancelled' THEN now()
      ELSE cancelled_at
    END,
    meta = CASE
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN
        COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'resubmitted', true,
          'resubmitted_at', now(),
          'resubmitted_by', v_uid,
          'resubmit_note', COALESCE(p_note, ''),
          'wizard_step', 'status'
        )
      ELSE meta
    END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  -- ── Issue lifecycle hooks (migration 20260820_001) ──
  BEGIN
    IF to_regclass('public.verification_issues') IS NOT NULL THEN
      IF v_from_status = 'additional_info_required'
         AND p_to_status IN ('submitted','under_review') THEN
        -- Seller resubmitted: flagged issues need recheck
        UPDATE public.verification_issues
        SET status = 'needs_recheck'
        WHERE request_id = p_request_id AND status = 'open';
      ELSIF p_to_status IN ('approved','rejected','cancelled') THEN
        -- Terminal decision: close out remaining issues
        UPDATE public.verification_issues
        SET status = 'resolved', resolved_at = now(), resolved_by = v_uid
        WHERE request_id = p_request_id AND status IN ('open','needs_recheck');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'verification_issues hook failed: %', SQLERRM;
  END;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_verification_status(uuid, text, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.transition_verification_status IS
  'Status transitions; sellers may resubmit additional_info_required → under_review; issue lifecycle hooks.';
