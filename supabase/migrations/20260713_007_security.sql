-- ============================================================
-- 007_security.sql
-- Purpose: Blocks, sessions, security events, shop invites, boosts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks (blocker_id);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_label text,
  user_agent text,
  ip_hint text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions (user_id, last_active_at DESC);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.listing_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boost_type text NOT NULL DEFAULT 'boost'
    CHECK (boost_type IN ('boost', 'featured', 'premium')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  payment_ref text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_response_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid,
  inbound_at timestamptz NOT NULL,
  replied_at timestamptz,
  response_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = auth.uid() THEN RAISE EXCEPTION 'Invalid user'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
  VALUES (auth.uid(), p_blocked_id, p_reason)
  ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason;
  IF to_regclass('public.seller_follows') IS NOT NULL THEN
    DELETE FROM public.seller_follows
    WHERE (seller_id = auth.uid() AND follower_id = p_blocked_id)
       OR (seller_id = p_blocked_id AND follower_id = auth.uid());
  END IF;
  INSERT INTO public.security_events (user_id, event_type, title, meta)
  VALUES (auth.uid(), 'block', 'Blocked a user', jsonb_build_object('blocked_id', p_blocked_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_people_you_may_know(p_limit integer DEFAULT 12)
RETURNS TABLE (
  user_id uuid, full_name text, avatar_url text, is_verified boolean,
  city text, mutual_count integer, reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);
BEGIN
  IF v_uid IS NULL OR to_regclass('public.seller_follows') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH my_following AS (
    SELECT sf.seller_id FROM public.seller_follows sf WHERE sf.follower_id = v_uid
  ),
  candidates AS (
    SELECT sf2.seller_id AS uid, count(*)::int AS mutuals
    FROM public.seller_follows sf2
    WHERE sf2.follower_id IN (SELECT seller_id FROM my_following)
      AND sf2.seller_id <> v_uid
      AND sf2.seller_id NOT IN (SELECT seller_id FROM my_following)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_uid AND b.blocked_id = sf2.seller_id)
           OR (b.blocker_id = sf2.seller_id AND b.blocked_id = v_uid)
      )
    GROUP BY sf2.seller_id
  )
  SELECT c.uid, p.full_name, p.avatar_url, COALESCE(p.is_verified, false), p.city, c.mutuals,
         CASE WHEN c.mutuals > 0 THEN c.mutuals || ' mutual connection(s)' ELSE 'Suggested seller' END
  FROM candidates c
  JOIN public.profiles p ON p.id = c.uid
  ORDER BY c.mutuals DESC, p.is_verified DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_listing_status(p_listing_ids uuid[], p_status text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_status NOT IN ('active', 'sold', 'deleted') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_listing_ids IS NULL OR array_length(p_listing_ids, 1) IS NULL THEN RETURN 0; END IF;
  UPDATE public.listings SET status = p_status, updated_at = now()
  WHERE id = ANY (p_listing_ids) AND seller_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_listings(p_listing_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_listing_ids IS NULL OR array_length(p_listing_ids, 1) IS NULL THEN RETURN 0; END IF;
  DELETE FROM public.listings WHERE id = ANY (p_listing_ids) AND seller_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_chat_response(
  p_chat_id uuid, p_inbound_at timestamptz, p_replied_at timestamptz DEFAULT now()
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_secs int; v_avg int; v_count int;
BEGIN
  IF v_uid IS NULL OR p_inbound_at IS NULL OR p_replied_at IS NULL OR p_replied_at < p_inbound_at THEN RETURN; END IF;
  v_secs := GREATEST(0, EXTRACT(EPOCH FROM (p_replied_at - p_inbound_at))::int);
  INSERT INTO public.chat_response_events (user_id, chat_id, inbound_at, replied_at, response_seconds)
  VALUES (v_uid, p_chat_id, p_inbound_at, p_replied_at, v_secs);
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COALESCE(avg_response_seconds, 0), COALESCE(response_sample_count, 0)
    INTO v_avg, v_count FROM public.profiles WHERE id = v_uid;
    IF v_count = 0 THEN v_avg := v_secs; v_count := 1;
    ELSE v_avg := ((v_avg * v_count) + v_secs) / (v_count + 1); v_count := v_count + 1; END IF;
    UPDATE public.profiles SET
      avg_response_seconds = v_avg,
      response_sample_count = v_count,
      fast_responder = (v_count >= 5 AND v_avg <= 1800)
    WHERE id = v_uid;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_event(p_event_type text, p_title text, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.security_events (user_id, event_type, title, meta)
  VALUES (auth.uid(), p_event_type, p_title, COALESCE(p_meta, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_listing_status(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_delete_listings(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_chat_response(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, jsonb) TO authenticated;
