-- Ensure QA simulation accounts have an org subscription row for gating consistency.
INSERT INTO public.organization_subscriptions (org_id, plan, status)
SELECT
  p.default_org_id,
  COALESCE(p.qa_simulated_plan, 'agency'),
  'active'
FROM public.profiles p
WHERE p.is_qa_account = true
  AND p.default_org_id IS NOT NULL
ON CONFLICT (org_id) DO UPDATE
SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  updated_at = NOW();
