-- Optional client grouping for agency multi-site monitoring
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS client_group TEXT;

CREATE INDEX IF NOT EXISTS idx_websites_org_client_group
  ON public.websites (org_id, client_group)
  WHERE org_id IS NOT NULL AND client_group IS NOT NULL;

COMMENT ON COLUMN public.websites.client_group IS 'Optional agency client label for grouping monitored sites';
