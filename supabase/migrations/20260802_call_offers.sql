-- Persistent SDP offers for call recovery.
-- The realtime 'ring' broadcast carries the offer inline and is ephemeral; if the
-- callee misses the broadcast the offer would be lost forever. This table lets the
-- caller persist the offer so the callee can recover it when the ring is missed
-- (fetched by GlobalCallListener using the callId from push metadata).
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS public.call_offers (
  call_id text PRIMARY KEY,
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  offer_json text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_offers ENABLE ROW LEVEL SECURITY;

-- Callers may insert their own offers
DROP POLICY IF EXISTS "call_offers_caller_insert" ON public.call_offers;
CREATE POLICY "call_offers_caller_insert" ON public.call_offers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);

-- Callees may read offers addressed to them
DROP POLICY IF EXISTS "call_offers_callee_read" ON public.call_offers;
CREATE POLICY "call_offers_callee_read" ON public.call_offers
  FOR SELECT TO authenticated
  USING (auth.uid() = callee_id);

-- Callers may delete their own offers (on hangup / cancel / answer)
DROP POLICY IF EXISTS "call_offers_caller_delete" ON public.call_offers;
CREATE POLICY "call_offers_caller_delete" ON public.call_offers
  FOR DELETE TO authenticated
  USING (auth.uid() = caller_id);
