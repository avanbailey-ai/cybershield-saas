-- Conversion funnel event tracking
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('scan_completed','paywall_viewed','upgrade_clicked','checkout_started','checkout_completed')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON public.conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created ON public.conversion_events(created_at);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert conversion events" ON public.conversion_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated insert conversion events" ON public.conversion_events
  FOR INSERT TO authenticated WITH CHECK (true);
