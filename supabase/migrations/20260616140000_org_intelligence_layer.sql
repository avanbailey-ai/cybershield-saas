-- Real-time org intelligence layer: anomaly feed + cached rolling risk / posture on organizations

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS rolling_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS posture_state TEXT
    CHECK (posture_state IN ('CRITICAL', 'DEGRADED', 'STABLE', 'HEALTHY')),
  ADD COLUMN IF NOT EXISTS intelligence_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.org_anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sudden_drop', 'new_critical_finding', 'volatility')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_anomalies_org_created
  ON public.org_anomalies(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_anomalies_org_unresolved
  ON public.org_anomalies(org_id, resolved)
  WHERE resolved = FALSE;

ALTER TABLE public.org_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_anomalies_select_member ON public.org_anomalies;
CREATE POLICY org_anomalies_select_member ON public.org_anomalies
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );
