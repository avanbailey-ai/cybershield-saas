-- Unified brain system: system_events, brain_insights, churn columns

CREATE TABLE IF NOT EXISTS public.system_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  source TEXT DEFAULT 'app',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_user ON public.system_events(user_id, created_at DESC);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert system events" ON public.system_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated insert system events" ON public.system_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brain_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insights JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_insights_created ON public.brain_insights(created_at DESC);

ALTER TABLE public.brain_insights ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS churn_risk_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Brain-safe autopilot config defaults
INSERT INTO public.autopilot_config (key, value)
VALUES
  ('cta_text_variant', '"Protect your site"'::jsonb),
  ('pricing_layout_order', '["pro","growth","agency"]'::jsonb),
  ('trust_signals_visible', 'true'::jsonb),
  ('urgency_level', '"medium"'::jsonb),
  ('show_partial_ai_earlier', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
