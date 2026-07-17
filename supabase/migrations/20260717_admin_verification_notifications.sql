-- Phase 8: Notify all admins about verification queue events.
-- Fans out into existing notifications table (one row per admin).

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := COALESCE(NULLIF(trim(p_body), ''), p_title);
  v_count integer := 0;
  r record;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title required';
  END IF;

  -- Any authenticated seller may emit admin queue alerts (submit / resubmit / payment proof).
  -- Admins may also emit for lifecycle events.
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id FROM public.profiles WHERE role = 'admin'
  LOOP
    BEGIN
      INSERT INTO public.notifications (
        user_id, type, title, body, message, link, read, data, meta, created_at
      ) VALUES (
        r.id,
        COALESCE(NULLIF(trim(p_type), ''), 'admin_verification'),
        trim(p_title),
        v_body,
        v_body,
        p_link,
        false,
        COALESCE(p_data, '{}'::jsonb),
        COALESCE(p_data, '{}'::jsonb),
        now()
      )
      RETURNING id INTO v_id;
      v_count := v_count + 1;
    EXCEPTION
      WHEN undefined_column THEN
        INSERT INTO public.notifications (user_id, type, title, body, read, created_at)
        VALUES (
          r.id,
          COALESCE(NULLIF(trim(p_type), ''), 'admin_verification'),
          trim(p_title),
          v_body,
          false,
          now()
        );
        v_count := v_count + 1;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.notify_admins(text, text, text, text, jsonb) IS
  'Insert in-app notifications for every admin (verification queue alerts).';

-- Enrich analytics with today_completed for dashboard cards
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
    'pending', (SELECT count(*) FROM public.verification_requests WHERE status IN ('pending', 'submitted', 'payment_pending', 'payment_confirmed', 'under_review', 'additional_info_required')),
    'under_review', (SELECT count(*) FROM public.verification_requests WHERE status = 'under_review'),
    'additional_info', (SELECT count(*) FROM public.verification_requests WHERE status = 'additional_info_required'),
    'payment_pending', (SELECT count(*) FROM public.verification_requests WHERE status = 'payment_pending'),
    'draft', (SELECT count(*) FROM public.verification_requests WHERE status = 'draft'),
    'expired', (SELECT count(*) FROM public.verification_requests WHERE status = 'expired'),
    'cancelled', (SELECT count(*) FROM public.verification_requests WHERE status = 'cancelled'),
    'verified_profiles', (SELECT count(*) FROM public.profiles WHERE COALESCE(is_verified, false) = true),
    'today_requests', (
      SELECT count(*) FROM public.verification_requests
      WHERE created_at >= date_trunc('day', now())
    ),
    'today_completed', (
      SELECT count(*) FROM public.verification_requests
      WHERE status IN ('approved', 'rejected')
        AND reviewed_at >= date_trunc('day', now())
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
    ),
    'awaiting_payment_confirm', (
      SELECT count(*) FROM public.verification_payments
      WHERE payment_status = 'awaiting_confirmation'
    ),
    'user_responded', (
      SELECT count(*) FROM public.verification_requests
      WHERE status = 'under_review'
        AND (
          COALESCE((meta->>'resubmitted')::boolean, false) = true
          OR meta ? 'resubmitted_at'
          OR (
            additional_info_message IS NOT NULL
            AND under_review_at IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND under_review_at >= reviewed_at
          )
        )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_verification_analytics() TO authenticated;
