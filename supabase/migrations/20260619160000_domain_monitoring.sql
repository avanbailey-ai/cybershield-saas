-- Domain monitoring: RDAP expiry probes, DNS snapshots, and expiry alert deduplication.

CREATE TABLE IF NOT EXISTS public.domain_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  registrar TEXT,
  expires_at TIMESTAMPTZ,
  days_until_expiry INT,
  dns_records JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_snapshots_website_checked
  ON public.domain_snapshots (website_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_snapshots_expires
  ON public.domain_snapshots (expires_at);

CREATE TABLE IF NOT EXISTS public.domain_expiry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  threshold_days INT NOT NULL,
  domain_expires_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, threshold_days, domain_expires_at)
);

CREATE INDEX IF NOT EXISTS idx_domain_expiry_alerts_website
  ON public.domain_expiry_alerts (website_id, alerted_at DESC);

ALTER TABLE public.domain_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_expiry_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS domain_snapshots_select_org ON public.domain_snapshots;
CREATE POLICY domain_snapshots_select_org ON public.domain_snapshots
  FOR SELECT TO authenticated
  USING (
    website_id IN (
      SELECT w.id FROM public.websites w
      WHERE w.user_id = auth.uid()
         OR w.org_id IN (
           SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS domain_expiry_alerts_select_org ON public.domain_expiry_alerts;
CREATE POLICY domain_expiry_alerts_select_org ON public.domain_expiry_alerts
  FOR SELECT TO authenticated
  USING (
    website_id IN (
      SELECT w.id FROM public.websites w
      WHERE w.user_id = auth.uid()
         OR w.org_id IN (
           SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
         )
    )
  );

COMMENT ON TABLE public.domain_snapshots IS 'Domain RDAP + DNS probes per website scan or weekly sweep.';
COMMENT ON TABLE public.domain_expiry_alerts IS 'Deduped domain expiry threshold notifications (60/30/14/7/0 days).';
