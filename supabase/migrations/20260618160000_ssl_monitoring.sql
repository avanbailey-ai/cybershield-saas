-- SSL certificate monitoring: store probes and expiry alert deduplication.

CREATE TABLE IF NOT EXISTS public.ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  issuer TEXT,
  subject TEXT,
  sans JSONB DEFAULT '[]'::jsonb,
  valid_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  days_until_expiry INT NOT NULL,
  chain_valid BOOLEAN DEFAULT true,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssl_certificates_website_checked
  ON public.ssl_certificates (website_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_ssl_certificates_expires
  ON public.ssl_certificates (expires_at);

CREATE TABLE IF NOT EXISTS public.ssl_expiry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  threshold_days INT NOT NULL,
  cert_expires_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, threshold_days, cert_expires_at)
);

CREATE INDEX IF NOT EXISTS idx_ssl_expiry_alerts_website
  ON public.ssl_expiry_alerts (website_id, alerted_at DESC);

ALTER TABLE public.ssl_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssl_expiry_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssl_certificates_select_org ON public.ssl_certificates;
CREATE POLICY ssl_certificates_select_org ON public.ssl_certificates
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

DROP POLICY IF EXISTS ssl_expiry_alerts_select_org ON public.ssl_expiry_alerts;
CREATE POLICY ssl_expiry_alerts_select_org ON public.ssl_expiry_alerts
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

COMMENT ON TABLE public.ssl_certificates IS 'TLS certificate probes per website scan or daily sweep.';
COMMENT ON TABLE public.ssl_expiry_alerts IS 'Deduped SSL expiry threshold notifications (30/14/7/3/0 days).';
