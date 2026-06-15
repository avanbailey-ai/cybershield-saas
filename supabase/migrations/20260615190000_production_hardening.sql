-- Production hardening: system_health, scan retry scheduling, claim filter

-- ── system_health observability ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_health_type_ts
  ON public.system_health (metric_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_timestamp
  ON public.system_health (timestamp DESC);

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.system_health FROM anon, authenticated;

COMMENT ON TABLE public.system_health IS 'Time-series operational metrics (queue depth, cron runs, etc.).';

-- ── scan_queue retry scheduling ──────────────────────────────────────────────
ALTER TABLE public.scan_queue
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scan_queue_scheduled
  ON public.scan_queue (scheduled_for ASC)
  WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- ── claim_scan_jobs — respect scheduled_for + priority ordering ──────────────
CREATE OR REPLACE FUNCTION public.claim_scan_jobs(p_limit int DEFAULT 10)
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
    started_at = now()
  FROM candidates c
  WHERE sq.id = c.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scan_jobs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(int) TO service_role;
