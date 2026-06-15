-- Scan worker observability metrics (production hardening)



CREATE TABLE IF NOT EXISTS public.scan_worker_metrics (

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type TEXT NOT NULL,

  queue_depth INTEGER NOT NULL DEFAULT 0,

  processed INTEGER NOT NULL DEFAULT 0,

  failed INTEGER NOT NULL DEFAULT 0,

  duration_ms INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);



CREATE INDEX IF NOT EXISTS idx_scan_worker_metrics_created_at

  ON public.scan_worker_metrics (created_at DESC);



CREATE INDEX IF NOT EXISTS idx_scan_worker_metrics_event_type

  ON public.scan_worker_metrics (event_type, created_at DESC);



ALTER TABLE public.scan_worker_metrics ENABLE ROW LEVEL SECURITY;



-- Service role only — metrics are written by the worker, not exposed to clients.

REVOKE ALL ON public.scan_worker_metrics FROM anon, authenticated;



COMMENT ON TABLE public.scan_worker_metrics IS 'Batch-level scan worker metrics for observability and capacity planning.';


