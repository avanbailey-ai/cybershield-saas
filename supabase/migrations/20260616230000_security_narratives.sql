-- Deterministic security narratives per completed scan (no AI / no scan data duplication)

CREATE TABLE IF NOT EXISTS public.security_narratives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  narrative JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT security_narratives_scan_id_unique UNIQUE (scan_id)
);

CREATE INDEX IF NOT EXISTS idx_security_narratives_org_generated
  ON public.security_narratives(org_id, generated_at DESC);

ALTER TABLE public.security_narratives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_narratives_select_member ON public.security_narratives;
CREATE POLICY security_narratives_select_member ON public.security_narratives
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );
