-- AI minimization: report cache + daily usage quotas

CREATE TABLE IF NOT EXISTS public.ai_report_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID        REFERENCES public.websites(id) ON DELETE CASCADE,
  scan_hash   TEXT        NOT NULL,
  bucket      BIGINT      NOT NULL,
  report_json JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (website_id, scan_hash, bucket)
);

CREATE INDEX IF NOT EXISTS idx_ai_report_cache_lookup
  ON public.ai_report_cache (website_id, scan_hash, bucket);

COMMENT ON TABLE public.ai_report_cache IS
  'Cached AI-enhanced security reports keyed by website, scan hash, and hourly bucket.';

CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  count       INT         NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_date
  ON public.ai_daily_usage (usage_date);

COMMENT ON TABLE public.ai_daily_usage IS
  'Daily OpenAI report generation count per user for plan quota enforcement.';

ALTER TABLE public.ai_report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_report_cache_service ON public.ai_report_cache;
CREATE POLICY ai_report_cache_service ON public.ai_report_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ai_daily_usage_select_own ON public.ai_daily_usage;
CREATE POLICY ai_daily_usage_select_own ON public.ai_daily_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_daily_usage_service ON public.ai_daily_usage;
CREATE POLICY ai_daily_usage_service ON public.ai_daily_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);
