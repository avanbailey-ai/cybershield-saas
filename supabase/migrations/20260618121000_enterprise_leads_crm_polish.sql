-- Owner CRM polish: spam/test statuses, admin notes, junk lead cleanup

ALTER TABLE public.enterprise_leads
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

ALTER TABLE public.enterprise_leads DROP CONSTRAINT IF EXISTS enterprise_leads_status_check;
ALTER TABLE public.enterprise_leads ADD CONSTRAINT enterprise_leads_status_check
  CHECK (status IN (
    'new', 'received', 'analyzed', 'responded', 'contacted', 'qualified', 'closed',
    'spam', 'test', 'invalid'
  ));

-- Mark known test/junk submission (name=avan, domain=s, created ~2026-06-16)
UPDATE public.enterprise_leads
SET status = 'spam',
    admin_notes = COALESCE(admin_notes, '') || E'\n[auto] Marked as spam/test during owner CRM polish.'
WHERE lower(trim(name)) = 'avan'
  AND lower(trim(email)) = 'avanbailey@gmail.com'
  AND lower(trim(coalesce(domain, ''))) = 's';

-- Zero pipeline value for excluded lead statuses
UPDATE public.enterprise_pipeline ep
SET value_estimate = 0
FROM public.enterprise_leads el
WHERE ep.lead_id = el.id
  AND el.status IN ('spam', 'test', 'invalid', 'closed');
