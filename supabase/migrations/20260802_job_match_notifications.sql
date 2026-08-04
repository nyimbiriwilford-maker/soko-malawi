-- ============================================================
-- Task 15 step 2 — job_match notifications.
-- 1. Let the match-job-cvs edge function (service role) create
--    notifications via notify_user, since auth.uid() is NULL there.
-- 2. Guarantee a user gets at most ONE job_match per job, so a
--    double-trigger of match-job-cvs can never duplicate.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_is_service boolean := (v_role = 'service_role');
  v_id uuid;
  v_body text := COALESCE(NULLIF(trim(p_body), ''), p_title);
BEGIN
  -- Edge functions (service role) have no auth.uid() — allow them.
  IF v_uid IS NULL AND NOT v_is_service THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL OR p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'user_id and title required';
  END IF;

  -- Self-notify or admin notifying another user (service role may notify anyone)
  IF NOT v_is_service AND p_user_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'notifications table missing';
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, body, message, link, read, data, meta, created_at
  ) VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(p_type), ''), 'system'),
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

  RETURN v_id;
EXCEPTION
  WHEN undefined_column THEN
    -- Older schema without message/link/data/meta
    INSERT INTO public.notifications (user_id, type, title, body, read, created_at)
    VALUES (
      p_user_id,
      COALESCE(NULLIF(trim(p_type), ''), 'system'),
      trim(p_title),
      v_body,
      false,
      now()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb) TO authenticated;

-- Dedupe safety net: one job_match notification per (user, job).
-- The edge function also pre-checks before inserting; this index catches any
-- race so running match-job-cvs twice for the same job can never create dupes.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_job_match_once
  ON public.notifications (user_id, ((data->>'job_id')))
  WHERE type = 'job_match';
