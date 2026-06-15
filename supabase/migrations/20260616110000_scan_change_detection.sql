-- Website change detection: persist comparable snapshots and individual changes.

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS scan_snapshot JSONB;

COMMENT ON COLUMN public.scans.scan_snapshot IS
  'Comparable scan state (headers, scripts, meta tags, endpoints) for diff detection.';

CREATE TABLE IF NOT EXISTS public.scan_changes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     UUID        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  website_id  UUID        NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description TEXT        NOT NULL,
  detected_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_changes_scan_id ON public.scan_changes (scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_changes_website_id ON public.scan_changes (website_id, detected_at DESC);

ALTER TABLE public.scan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_changes_select_org ON public.scan_changes;
CREATE POLICY scan_changes_select_org ON public.scan_changes
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

COMMENT ON TABLE public.scan_changes IS
  'Individual website changes detected between consecutive completed scans.';
