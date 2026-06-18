-- QA accounts simulate customer plans (pro/growth/agency) without automatic enterprise portal access.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS qa_enterprise_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.qa_enterprise_enabled IS
  'When is_qa_account=true, allows enterprise portal simulation. Default false — agency QA uses standard dashboard.';

-- Ensure test QA account does not auto-route to enterprise portal.
UPDATE public.profiles
SET qa_enterprise_enabled = false, updated_at = NOW()
WHERE is_qa_account = true;
