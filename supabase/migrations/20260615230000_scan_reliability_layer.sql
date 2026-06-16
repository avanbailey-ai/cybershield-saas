-- Scan reliability layer: queue locks, scan SSOT linkage, timeout recovery, scans realtime

-- ── scan_queue lock + scan linkage ───────────────────────────────────────────
ALTER TABLE public.scan_queue
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_queue_expires
  ON public.scan_queue (expires_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_scan_queue_scan_id
  ON public.scan_queue (scan_id)
  WHERE scan_id IS NOT NULL;

-- ── Atomic claim — locked_by + expires_at (3 min lock window) ─────────────────
CREATE OR REPLACE FUNCTION public.claim_scan_jobs(
  p_limit int DEFAULT 10,
  p_worker_id text DEFAULT 'worker'
)
RETURNS SETOF public.scan_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.scan_queue
    WHERE (
      status = 'pending'
      AND (scheduled_for IS NULL OR scheduled_for <= now())
    )
    OR (status = 'failed' AND attempts < COALESCE(max_attempts, 3))
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.scan_queue sq
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    expires_at = now() + interval '3 minutes',
    started_at = COALESCE(sq.started_at, now())
  FROM candidates c
  WHERE sq.id = c.id
  RETURNING sq.*;
END;
$$;

-- ── Fail jobs past lock expiry (processing timeout ~3 min) ───────────────────
CREATE OR REPLACE FUNCTION public.fail_expired_scan_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count int;
BEGIN
  WITH expired AS (
    SELECT id, scan_id
    FROM public.scan_queue
    WHERE status = 'processing'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  ),
  fail_queue AS (
    UPDATE public.scan_queue sq
    SET
      status = 'failed',
      error = 'scan_timeout',
      result = jsonb_build_object('error', 'scan_timeout'),
      completed_at = now(),
      locked_at = NULL,
      locked_by = NULL,
      expires_at = NULL,
      scheduled_for = NULL
    FROM expired e
    WHERE sq.id = e.id
    RETURNING sq.id
  )
  SELECT COUNT(*)::int INTO failed_count FROM fail_queue;

  UPDATE public.scans s
  SET
    status = 'failed',
    error_message = 'scan_timeout',
    completed_at = now()
  FROM public.scan_queue sq
  WHERE sq.status = 'failed'
    AND sq.error = 'scan_timeout'
    AND sq.completed_at >= now() - interval '1 minute'
    AND s.id = sq.scan_id
    AND s.status IN ('pending', 'running');

  UPDATE public.scans s
  SET
    status = 'failed',
    error_message = 'scan_timeout',
    completed_at = now()
  WHERE s.status = 'running'
    AND s.started_at < now() - interval '3 minutes';

  RETURN failed_count;
END;
$$;

-- ── Reclaim stale locks (>10 min) — requeue for retry ────────────────────────
CREATE OR REPLACE FUNCTION public.reclaim_stale_scan_jobs(p_stale_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reclaimed int;
BEGIN
  UPDATE public.scan_queue
  SET
    status = 'pending',
    locked_at = NULL,
    locked_by = NULL,
    expires_at = NULL,
    started_at = NULL
  WHERE status = 'processing'
    AND locked_at IS NOT NULL
    AND locked_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS reclaimed = ROW_COUNT;

  IF reclaimed > 0 THEN
    UPDATE public.scans s
    SET
      status = 'failed',
      error_message = 'worker_crashed',
      completed_at = now()
  WHERE s.status = 'running'
    AND s.started_at < now() - (p_stale_minutes || ' minutes')::interval;
  END IF;

  RETURN reclaimed;
END;
$$;

-- ── Scans realtime for dashboard SSOT ────────────────────────────────────────
ALTER TABLE public.scans REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.claim_scan_jobs(int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_expired_scan_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_expired_scan_jobs() TO service_role;
