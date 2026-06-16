-- Enterprise lead scan context + automated email workflow statuses

ALTER TABLE public.enterprise_leads
  ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_score INTEGER;

ALTER TABLE public.enterprise_leads DROP CONSTRAINT IF EXISTS enterprise_leads_status_check;
ALTER TABLE public.enterprise_leads ADD CONSTRAINT enterprise_leads_status_check
  CHECK (status IN ('new', 'received', 'analyzed', 'responded', 'contacted', 'qualified', 'closed'));

CREATE INDEX IF NOT EXISTS idx_enterprise_leads_scan ON public.enterprise_leads(scan_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_domain ON public.enterprise_leads(domain);
