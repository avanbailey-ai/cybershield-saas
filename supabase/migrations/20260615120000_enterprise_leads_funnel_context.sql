-- Funnel context on enterprise leads (scan score + risk tier at submission)

ALTER TABLE public.enterprise_leads
  ADD COLUMN IF NOT EXISTS last_scan_score INTEGER,
  ADD COLUMN IF NOT EXISTS risk_level TEXT;

CREATE INDEX IF NOT EXISTS idx_enterprise_leads_risk_level ON public.enterprise_leads(risk_level);
