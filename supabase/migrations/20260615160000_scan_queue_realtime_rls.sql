-- Enable Supabase Realtime on scan_queue + ensure user RLS

ALTER TABLE public.scan_queue REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scan_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_queue;
  END IF;
END $$;

ALTER TABLE public.scan_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_queue_select_own ON public.scan_queue;
CREATE POLICY scan_queue_select_own ON public.scan_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Workers use service_role (bypasses RLS). Users may insert via orchestrator only on server;
-- keep insert policy for authenticated enqueue paths that use user client.
DROP POLICY IF EXISTS scan_queue_insert_own ON public.scan_queue;
CREATE POLICY scan_queue_insert_own ON public.scan_queue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
