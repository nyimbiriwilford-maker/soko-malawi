-- ============================================================
-- Fix admin manual verification actions (remove badge / suspend / etc.)
-- Ensures SECURITY DEFINER RPC works and profile columns exist.
-- ============================================================

-- Profile columns used by badge management
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'profiles missing — skip';
    RETURN;
  END IF;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_status text,
    ADD COLUMN IF NOT EXISTS verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS verified_by uuid,
    ADD COLUMN IF NOT EXISTS rejection_reason text,
    ADD COLUMN IF NOT EXISTS verification_request_id uuid,
    ADD COLUMN IF NOT EXISTS verification_level text,
    ADD COLUMN IF NOT EXISTS verification_expiry timestamptz;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  END;
$$;

-- Robust manual action RPC (admin only, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_manual_verification_action(
  p_action text,
  p_seller_id uuid DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_action IN ('remove_badge', 'suspend') THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = CASE WHEN v_action = 'suspend' THEN 'suspended' ELSE 'removed' END,
      verified_at = NULL,
      rejection_reason = v_note,
      updated_at = now()
    WHERE id = v_seller;

    BEGIN
      IF to_regclass('public.shops') IS NOT NULL THEN
        UPDATE public.shops SET is_verified = false WHERE owner_id = v_seller;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = CASE WHEN v_action = 'suspend' THEN 'cancelled' ELSE status END,
        admin_note = v_note,
        updated_at = now()
      WHERE id = v_req.id;

      BEGIN
        INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
        VALUES (
          v_req.id,
          COALESCE(v_req.status, 'approved'),
          CASE WHEN v_action = 'suspend' THEN 'cancelled' ELSE COALESCE(v_req.status, 'approved') END,
          v_uid,
          v_note,
          jsonb_build_object('event', CASE WHEN v_action = 'suspend' THEN 'suspended' ELSE 'badge_removed' END, 'admin', true)
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

  ELSIF v_action IN ('approve', 'reactivate') THEN
    UPDATE public.profiles SET
      is_verified = true,
      verification_status = 'approved',
      verified_at = COALESCE(verified_at, now()),
      verified_by = v_uid,
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = v_seller;

    BEGIN
      IF to_regclass('public.shops') IS NOT NULL THEN
        UPDATE public.shops SET is_verified = true WHERE owner_id = v_seller;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = 'approved',
        admin_note = v_note,
        reviewed_by = v_uid,
        reviewed_at = COALESCE(reviewed_at, now()),
        updated_at = now()
      WHERE id = v_req.id;
      BEGIN
        INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
        VALUES (v_req.id, v_req.status, 'approved', v_uid, v_note, jsonb_build_object('event', v_action, 'admin', true));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

  ELSIF v_action = 'reject' THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = 'rejected',
      rejection_reason = v_note,
      verified_at = NULL,
      updated_at = now()
    WHERE id = v_seller;

    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = 'rejected',
        rejection_reason = v_note,
        admin_note = v_note,
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = v_req.id;
    END IF;

  ELSIF v_action IN ('reverify', 'request_reverification') THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = 'reverification_required',
      rejection_reason = v_note,
      verified_at = NULL,
      updated_at = now()
    WHERE id = v_seller;

    BEGIN
      IF to_regclass('public.shops') IS NOT NULL THEN
        UPDATE public.shops SET is_verified = false WHERE owner_id = v_seller;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    IF v_req.id IS NOT NULL THEN
      UPDATE public.verification_requests SET
        status = 'expired',
        admin_note = v_note,
        updated_at = now()
      WHERE id = v_req.id;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- Best-effort audit (table may not exist)
  BEGIN
    INSERT INTO public.verification_admin_audit (admin_id, action, entity_type, entity_id, note, meta)
    VALUES (
      v_uid,
      'manual_' || v_action,
      'seller',
      v_seller::text,
      v_note,
      jsonb_build_object('request_id', p_request_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_action,
    'seller_id', v_seller,
    'request_id', v_req.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manual_verification_action(text, uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_manual_verification_action IS
  'Admin remove/suspend/approve/reject/reverify seller badge — SECURITY DEFINER';
