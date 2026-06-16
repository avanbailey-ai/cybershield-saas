-- Backfill scans.org_id from websites for org-scoped canonical queries.

UPDATE public.scans s
SET org_id = w.org_id
FROM public.websites w
WHERE s.website_id = w.id
  AND s.org_id IS NULL
  AND w.org_id IS NOT NULL;
