-- CEO advisory system: daily metrics, insights, alerts (read-only / decision-support)

CREATE TABLE IF NOT EXISTS public.business_metrics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_metrics_daily_date ON public.business_metrics_daily(date DESC);

ALTER TABLE public.business_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ceo_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem TEXT NOT NULL,
  impact TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ceo_insights_priority ON public.ceo_insights(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ceo_insights_dismissed ON public.ceo_insights(dismissed) WHERE dismissed = FALSE;

ALTER TABLE public.ceo_insights ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ceo_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_alerts_unread ON public.ceo_alerts(read, created_at DESC) WHERE read = FALSE;

ALTER TABLE public.ceo_alerts ENABLE ROW LEVEL SECURITY;

-- CEO recommendations cache (advisory only — applied manually via admin API)
INSERT INTO public.autopilot_config (key, value)
VALUES ('ceo_recommendations', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.autopilot_config (key, value)
VALUES ('ceo_last_analysis', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
