-- ============================================================
-- Admin Verification Settings module
-- Dynamic control of fees, methods, docs, validity, manual ops,
-- analytics — no day-to-day manual DB edits.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN false
    ELSE EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  END;
$$;

-- Audit log for admin configuration + badge actions
CREATE TABLE IF NOT EXISTS public.verification_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_admin_audit_created
  ON public.verification_admin_audit (created_at DESC);

ALTER TABLE public.verification_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_admin_audit_admin" ON public.verification_admin_audit;
CREATE POLICY "verification_admin_audit_admin" ON public.verification_admin_audit
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public._verification_admin_log(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.verification_admin_audit (admin_id, action, entity_type, entity_id, note, meta)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_note, COALESCE(p_meta, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ── Update singleton settings ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_verification_settings(
  p_patch jsonb
)
RETURNS public.verification_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.verification_settings;
  p jsonb := COALESCE(p_patch, '{}'::jsonb);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.verification_settings SET
    fee_amount = CASE WHEN p ? 'fee_amount' THEN (p->>'fee_amount')::numeric ELSE fee_amount END,
    fee_currency = CASE WHEN p ? 'fee_currency' THEN p->>'fee_currency' ELSE fee_currency END,
    review_period_hours = CASE WHEN p ? 'review_period_hours' THEN (p->>'review_period_hours')::int ELSE review_period_hours END,
    request_expiry_days = CASE WHEN p ? 'request_expiry_days' THEN (p->>'request_expiry_days')::int ELSE request_expiry_days END,
    additional_info_deadline_days = CASE WHEN p ? 'additional_info_deadline_days' THEN (p->>'additional_info_deadline_days')::int ELSE additional_info_deadline_days END,
    verification_validity_days = CASE
      WHEN p ? 'verification_validity_days' THEN
        CASE WHEN p->>'verification_validity_days' IS NULL OR p->>'verification_validity_days' = '' OR p->>'verification_validity_days' = 'null'
          THEN NULL ELSE (p->>'verification_validity_days')::int END
      ELSE verification_validity_days
    END,
    accepted_document_types = CASE
      WHEN p ? 'accepted_document_types' THEN
        ARRAY(SELECT jsonb_array_elements_text(p->'accepted_document_types'))
      ELSE accepted_document_types
    END,
    supported_payment_methods = CASE
      WHEN p ? 'supported_payment_methods' THEN
        ARRAY(SELECT jsonb_array_elements_text(p->'supported_payment_methods'))
      ELSE supported_payment_methods
    END,
    default_verification_type_code = CASE WHEN p ? 'default_verification_type_code' THEN p->>'default_verification_type_code' ELSE default_verification_type_code END,
    auto_submit_on_payment = CASE WHEN p ? 'auto_submit_on_payment' THEN (p->>'auto_submit_on_payment')::boolean ELSE auto_submit_on_payment END,
    require_documents = CASE WHEN p ? 'require_documents' THEN (p->>'require_documents')::boolean ELSE require_documents END,
    is_enabled = CASE WHEN p ? 'is_enabled' THEN (p->>'is_enabled')::boolean ELSE is_enabled END,
    extra = CASE WHEN p ? 'extra' THEN COALESCE(extra, '{}'::jsonb) || (p->'extra') ELSE extra END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    INSERT INTO public.verification_settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
    SELECT * INTO v_row FROM public.verification_settings WHERE id = 1;
  END IF;

  PERFORM public._verification_admin_log(
    'settings_updated', 'verification_settings', '1',
    'Admin updated verification settings', p
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_verification_settings(jsonb) TO authenticated;

-- ── Update verification type (fees + docs) ────────────────
CREATE OR REPLACE FUNCTION public.admin_update_verification_type(
  p_code text,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_default_fee_amount numeric DEFAULT NULL,
  p_required_document_types text[] DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_sort_order integer DEFAULT NULL,
  p_meta jsonb DEFAULT NULL
)
RETURNS public.verification_types
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.verification_types;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RAISE EXCEPTION 'type code required'; END IF;

  UPDATE public.verification_types SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    default_fee_amount = COALESCE(p_default_fee_amount, default_fee_amount),
    required_document_types = COALESCE(p_required_document_types, required_document_types),
    is_active = COALESCE(p_is_active, is_active),
    sort_order = COALESCE(p_sort_order, sort_order),
    meta = CASE WHEN p_meta IS NOT NULL THEN COALESCE(meta, '{}'::jsonb) || p_meta ELSE meta END,
    updated_at = now()
  WHERE code = p_code
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    INSERT INTO public.verification_types (
      code, name, description, default_fee_amount, required_document_types, is_active, sort_order, meta
    ) VALUES (
      p_code,
      COALESCE(p_name, initcap(p_code)),
      p_description,
      COALESCE(p_default_fee_amount, 5000),
      COALESCE(p_required_document_types, ARRAY['national_id','selfie']),
      COALESCE(p_is_active, true),
      COALESCE(p_sort_order, 50),
      COALESCE(p_meta, '{}'::jsonb)
    )
    RETURNING * INTO v_row;
  END IF;

  PERFORM public._verification_admin_log(
    'type_updated', 'verification_types', p_code,
    'Admin updated verification type',
    jsonb_build_object('fee', p_default_fee_amount, 'docs', p_required_document_types)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_verification_type(text, text, text, numeric, text[], boolean, integer, jsonb) TO authenticated;

-- ── Update payment method ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_verification_payment_method(
  p_code text,
  p_is_active boolean DEFAULT NULL,
  p_instructions text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_sort_order integer DEFAULT NULL,
  p_meta jsonb DEFAULT NULL
)
RETURNS public.verification_payment_methods
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.verification_payment_methods;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.verification_payment_methods SET
    is_active = COALESCE(p_is_active, is_active),
    instructions = COALESCE(p_instructions, instructions),
    name = COALESCE(p_name, name),
    sort_order = COALESCE(p_sort_order, sort_order),
    meta = CASE WHEN p_meta IS NOT NULL THEN COALESCE(meta, '{}'::jsonb) || p_meta ELSE meta END,
    updated_at = now()
  WHERE code = p_code
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment method not found: %', p_code; END IF;

  -- Keep settings.supported_payment_methods in sync with active methods
  UPDATE public.verification_settings SET
    supported_payment_methods = COALESCE((
      SELECT array_agg(code ORDER BY sort_order)
      FROM public.verification_payment_methods WHERE is_active = true
    ), supported_payment_methods),
    updated_at = now()
  WHERE id = 1;

  PERFORM public._verification_admin_log(
    'payment_method_updated', 'verification_payment_methods', p_code,
    'Admin updated payment method',
    jsonb_build_object('is_active', p_is_active, 'instructions', p_instructions)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_verification_payment_method(text, boolean, text, text, integer, jsonb) TO authenticated;

-- ── Manual verification lifecycle actions ─────────────────
CREATE OR REPLACE FUNCTION public.admin_manual_verification_action(
  p_action text, -- remove_badge | suspend | approve | reject | reverify | reactivate
  p_seller_id uuid DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_req public.verification_requests;
  v_seller uuid;
  v_note text := COALESCE(NULLIF(trim(p_note), ''), 'Admin action');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.verification_requests WHERE id = p_request_id;
    IF FOUND THEN v_seller := v_req.seller_id; END IF;
  END IF;
  v_seller := COALESCE(v_seller, p_seller_id);
  IF v_seller IS NULL THEN RAISE EXCEPTION 'seller_id or request_id required'; END IF;

  IF v_action = 'remove_badge' OR v_action = 'suspend' THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = CASE WHEN v_action = 'suspend' THEN 'suspended' ELSE 'removed' END,
      verified_at = NULL,
      rejection_reason = v_note,
      updated_at = now()
    WHERE id = v_seller;

    IF to_regclass('public.shops') IS NOT NULL THEN
      BEGIN
        UPDATE public.shops SET is_verified = false WHERE owner_id = v_seller;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = CASE WHEN v_action = 'suspend' THEN 'cancelled' ELSE status END,
        admin_note = v_note,
        updated_at = now()
      WHERE id = v_req.id;

      INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
      VALUES (
        v_req.id, v_req.status,
        CASE WHEN v_action = 'suspend' THEN 'cancelled' ELSE COALESCE(v_req.status, 'approved') END,
        v_uid, v_note,
        jsonb_build_object('event', CASE WHEN v_action = 'suspend' THEN 'suspended' ELSE 'badge_removed' END, 'admin', true)
      );
    END IF;

  ELSIF v_action = 'approve' THEN
    IF v_req.id IS NULL THEN
      -- Create approved request shell if none
      INSERT INTO public.verification_requests (seller_id, status, amount_due, amount_paid, currency, admin_note, reviewed_by, reviewed_at, submitted_at, under_review_at, payment_confirmed_at)
      VALUES (v_seller, 'approved', 0, 0, 'MWK', v_note, v_uid, now(), now(), now(), now())
      RETURNING * INTO v_req;
    ELSE
      PERFORM public.transition_verification_status(v_req.id, 'approved', v_note, NULL, NULL);
      SELECT * INTO v_req FROM public.verification_requests WHERE id = v_req.id;
    END IF;
    -- Ensure profile + shops
    UPDATE public.profiles SET
      is_verified = true,
      verification_status = 'approved',
      verified_at = now(),
      verified_by = v_uid,
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = v_seller;
    IF to_regclass('public.shops') IS NOT NULL THEN
      BEGIN
        UPDATE public.shops SET is_verified = true WHERE owner_id = v_seller;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

  ELSIF v_action = 'reject' THEN
    IF v_req.id IS NOT NULL THEN
      PERFORM public.transition_verification_status(v_req.id, 'rejected', v_note, v_note, NULL);
    END IF;
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = 'rejected',
      rejection_reason = v_note,
      updated_at = now()
    WHERE id = v_seller;

  ELSIF v_action = 'reverify' OR v_action = 'request_reverification' THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = 'reverification_required',
      rejection_reason = v_note,
      updated_at = now()
    WHERE id = v_seller;
    IF to_regclass('public.shops') IS NOT NULL THEN
      BEGIN
        UPDATE public.shops SET is_verified = false WHERE owner_id = v_seller;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = 'expired',
        admin_note = v_note,
        updated_at = now()
      WHERE id = v_req.id;
      INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
      VALUES (v_req.id, v_req.status, 'expired', v_uid, v_note, jsonb_build_object('event', 'reverification_required'));
    END IF;

  ELSIF v_action = 'reactivate' THEN
    UPDATE public.profiles SET
      is_verified = true,
      verification_status = 'approved',
      verified_at = COALESCE(verified_at, now()),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = v_seller;
    IF to_regclass('public.shops') IS NOT NULL THEN
      BEGIN
        UPDATE public.shops SET is_verified = true WHERE owner_id = v_seller;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF v_req.id IS NOT NULL THEN
      INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
      VALUES (v_req.id, v_req.status, 'approved', v_uid, v_note, jsonb_build_object('event', 'reactivated'));
      UPDATE public.verification_requests SET status = 'approved', admin_note = v_note, updated_at = now() WHERE id = v_req.id;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  PERFORM public._verification_admin_log(
    'manual_' || v_action, 'seller', v_seller::text, v_note,
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_action,
    'seller_id', v_seller,
    'request_id', v_req.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manual_verification_action(text, uuid, uuid, text) TO authenticated;

-- ── Analytics ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_verification_analytics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT jsonb_build_object(
    'total_requests', (SELECT count(*) FROM public.verification_requests),
    'approved', (SELECT count(*) FROM public.verification_requests WHERE status = 'approved'),
    'rejected', (SELECT count(*) FROM public.verification_requests WHERE status = 'rejected'),
    'pending', (SELECT count(*) FROM public.verification_requests WHERE status IN ('pending', 'submitted', 'payment_pending', 'payment_confirmed')),
    'under_review', (SELECT count(*) FROM public.verification_requests WHERE status = 'under_review'),
    'additional_info', (SELECT count(*) FROM public.verification_requests WHERE status = 'additional_info_required'),
    'draft', (SELECT count(*) FROM public.verification_requests WHERE status = 'draft'),
    'expired', (SELECT count(*) FROM public.verification_requests WHERE status = 'expired'),
    'cancelled', (SELECT count(*) FROM public.verification_requests WHERE status = 'cancelled'),
    'verified_profiles', (SELECT count(*) FROM public.profiles WHERE COALESCE(is_verified, false) = true),
    'today_requests', (
      SELECT count(*) FROM public.verification_requests
      WHERE created_at >= date_trunc('day', now())
    ),
    'month_requests', (
      SELECT count(*) FROM public.verification_requests
      WHERE created_at >= date_trunc('month', now())
    ),
    'total_revenue', (
      SELECT COALESCE(sum(payment_amount), 0)
      FROM public.verification_payments
      WHERE payment_status = 'confirmed'
    ),
    'approval_rate', (
      SELECT CASE
        WHEN count(*) FILTER (WHERE status IN ('approved', 'rejected')) = 0 THEN 0
        ELSE round(
          100.0 * count(*) FILTER (WHERE status = 'approved')
          / nullif(count(*) FILTER (WHERE status IN ('approved', 'rejected')), 0),
          1
        )
      END
      FROM public.verification_requests
    ),
    'manually_removed', (
      SELECT count(*) FROM public.verification_admin_audit
      WHERE action IN ('manual_remove_badge', 'manual_suspend')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_verification_analytics() TO authenticated;

-- Admin list verified / rejected profiles helper
CREATE OR REPLACE FUNCTION public.admin_list_verification_profiles(p_filter text DEFAULT 'verified')
RETURNS TABLE (
  id uuid,
  full_name text,
  city text,
  phone text,
  is_verified boolean,
  verification_status text,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  IF p_filter = 'verified' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.city, p.phone, p.is_verified, p.verification_status,
           p.verified_at, p.rejection_reason, p.created_at
    FROM public.profiles p
    WHERE COALESCE(p.is_verified, false) = true
    ORDER BY p.verified_at DESC NULLS LAST
    LIMIT 200;
  ELSIF p_filter = 'rejected' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.city, p.phone, p.is_verified, p.verification_status,
           p.verified_at, p.rejection_reason, p.created_at
    FROM public.profiles p
    WHERE p.verification_status = 'rejected'
       OR p.rejection_reason IS NOT NULL
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT 200;
  ELSE
    RETURN QUERY
    SELECT p.id, p.full_name, p.city, p.phone, p.is_verified, p.verification_status,
           p.verified_at, p.rejection_reason, p.created_at
    FROM public.profiles p
    WHERE p.verification_status IS NOT NULL AND p.verification_status NOT IN ('none', '')
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT 200;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_verification_profiles(text) TO authenticated;

-- Ensure settings row + extra defaults for promo
UPDATE public.verification_settings
SET extra = COALESCE(extra, '{}'::jsonb) || jsonb_build_object(
  'promotion', COALESCE(extra->'promotion', jsonb_build_object(
    'enabled', false,
    'amount', null,
    'start_date', null,
    'end_date', null,
    'by_type', '{}'::jsonb
  )),
  'max_review_hours', COALESCE((extra->>'max_review_hours')::int, 72),
  'require_reverification_on_expiry', COALESCE((extra->>'require_reverification_on_expiry')::boolean, false),
  'user_facing_estimate', COALESCE(extra->>'user_facing_estimate', 'Verification usually takes 24-48 hours.')
)
WHERE id = 1;

COMMENT ON TABLE public.verification_admin_audit IS 'Immutable admin actions on verification config and badges';
