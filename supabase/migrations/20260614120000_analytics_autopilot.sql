-- Unified analytics events (extends conversion funnel tracking)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert analytics events" ON public.analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated insert analytics events" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- A/B experiments
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  traffic_split NUMERIC DEFAULT 0.5,
  conversions_a INTEGER DEFAULT 0,
  impressions_a INTEGER DEFAULT 0,
  conversions_b INTEGER DEFAULT 0,
  impressions_b INTEGER DEFAULT 0,
  winner TEXT CHECK (winner IN ('a', 'b', NULL)),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read experiments" ON public.experiments
  FOR SELECT TO anon, authenticated USING (true);

-- Autopilot UI/UX config (safe keys only)
CREATE TABLE IF NOT EXISTS public.autopilot_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read autopilot config" ON public.autopilot_config
  FOR SELECT TO anon, authenticated USING (true);

-- Seed experiments
INSERT INTO public.experiments (name, variant_a, variant_b, traffic_split)
VALUES
  (
    'cta_text',
    '{"text": "Protect your site"}'::jsonb,
    '{"text": "Start monitoring now"}'::jsonb,
    0.5
  ),
  (
    'paywall_timing',
    '{"delay_ms": 0}'::jsonb,
    '{"delay_ms": 3000}'::jsonb,
    0.5
  )
ON CONFLICT (name) DO NOTHING;

-- Default autopilot config
INSERT INTO public.autopilot_config (key, value)
VALUES
  ('highlighted_plan', '"growth"'::jsonb),
  ('cta_placement', '"both"'::jsonb),
  ('headline_variant', '"default"'::jsonb),
  ('paywall_delay_ms', '2000'::jsonb),
  ('autopilot_last_run', 'null'::jsonb),
  ('autopilot_recommendations', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
