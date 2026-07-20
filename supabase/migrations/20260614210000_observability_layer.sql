-- Observability layer: structured logs, traces, metrics
-- Layer 5 — additive infrastructure only

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('auth','billing','scan','queue','worker','ui','api')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID,
  trace_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS system_logs_type_idx ON public.system_logs(type);
CREATE INDEX IF NOT EXISTS system_logs_trace_idx ON public.system_logs(trace_id);
CREATE INDEX IF NOT EXISTS system_logs_created_idx ON public.system_logs(created_at DESC);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_logs_select_own ON public.system_logs;
CREATE POLICY system_logs_select_own ON public.system_logs FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'scan',
  user_id UUID,
  website_id UUID,
  scan_id UUID,
  job_id UUID,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS traces_trace_id_idx ON public.traces(trace_id);
ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS traces_select_own ON public.traces;
CREATE POLICY traces_select_own ON public.traces FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.trace_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  step TEXT NOT NULL,
  layer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trace_steps_trace_id_idx ON public.trace_steps(trace_id);
ALTER TABLE public.trace_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS system_metrics_name_time_idx ON public.system_metrics(metric_name, recorded_at DESC);
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scan_queue ADD COLUMN IF NOT EXISTS trace_id UUID;
