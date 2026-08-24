-- ================================================================
-- Auto-expire verification requests past additional_info_deadline
-- ================================================================
-- When a verification is in 'additional_info_required' status and
-- the deadline has passed, automatically transition to 'expired'.
-- Admins can reopen via override if needed.
-- ================================================================

-- ── 1) Function to expire overdue additional_info_required requests ──
CREATE OR REPLACE FUNCTION public.auto_expire_overdue_verification_requests()
RETURNS TABLE(
  expired_count integer,
  request_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer := 0;
  v_request_ids uuid[] := ARRAY[]::uuid[];
  r record;
  v_system_uid uuid;
BEGIN
  -- Use a system user ID for audit (or NULL if not available)
  v_system_uid := (SELECT id FROM auth.users WHERE email = 'system@sokomw.com' LIMIT 1);

  -- Find all requests that are overdue for resubmission
  FOR r IN
    SELECT id, seller_id, additional_info_deadline_at
    FROM public.verification_requests
    WHERE status = 'additional_info_required'
      AND additional_info_deadline_at IS NOT NULL
      AND additional_info_deadline_at < now()
      -- Make sure they haven't resubmitted (no under_review event after deadline)
      AND NOT EXISTS (
        SELECT 1 FROM public.verification_status_events ev
        WHERE ev.request_id = verification_requests.id
          AND ev.to_status = 'under_review'
          AND ev.created_at > verification_requests.additional_info_deadline_at
      )
      -- Only process requests from last 180 days to avoid ancient data
      AND created_at > now() - interval '180 days'
  LOOP
    -- Transition to expired status
    UPDATE public.verification_requests
    SET
      status = 'expired',
      rejection_reason = 'Verification expired: required documents were not submitted before the deadline of '
        || to_char(r.additional_info_deadline_at, 'YYYY-MM-DD HH24:MI'),
      updated_at = now()
    WHERE id = r.id;

    -- Log status event
    INSERT INTO public.verification_status_events (
      request_id,
      from_status,
      to_status,
      actor_id,
      note,
      meta
    ) VALUES (
      r.id,
      'additional_info_required',
      'expired',
      v_system_uid,
      'Auto-expired: seller did not resubmit before deadline',
      jsonb_build_object(
        'auto_expired', true,
        'deadline_was', r.additional_info_deadline_at,
        'expired_at', now()
      )
    );

    -- Notify seller
    BEGIN
      PERFORM public.notify_user(
        r.seller_id,
        'verification_expired',
        'Verification request expired',
        'Your verification request expired because the required documents were not submitted before the deadline. You can start a new verification request.',
        '/verify',
        jsonb_build_object('request_id', r.id)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Soft fail on notification
      NULL;
    END;

    v_expired := v_expired + 1;
    v_request_ids := array_append(v_request_ids, r.id);
  END LOOP;

  RETURN QUERY SELECT v_expired, v_request_ids;
END;
$$;

COMMENT ON FUNCTION public.auto_expire_overdue_verification_requests IS
  'Auto-expire verification requests in additional_info_required status past their deadline. Returns count and IDs of expired requests.';

-- Grant execute to service role (for cron/scheduled execution)
GRANT EXECUTE ON FUNCTION public.auto_expire_overdue_verification_requests() TO service_role;

-- Grant execute to authenticated admins (for manual trigger)
GRANT EXECUTE ON FUNCTION public.auto_expire_overdue_verification_requests() TO authenticated;

-- ── 2) Schedule with pg_cron if available (runs every hour) ──
DO $$
BEGIN
  -- Try to create pg_cron extension if not exists
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available — call auto_expire_overdue_verification_requests() from an external scheduler';
      RETURN;
    END;
  END;

  -- Unschedule existing job if any
  BEGIN
    PERFORM cron.unschedule('soko_auto_expire_verifications');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule to run every hour
  PERFORM cron.schedule(
    'soko_auto_expire_verifications',
    '0 * * * *', -- Every hour at minute 0
    $cron$ SELECT public.auto_expire_overdue_verification_requests(); $cron$
  );

  RAISE NOTICE 'Scheduled auto_expire_overdue_verification_requests to run hourly via pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END;
$$;
