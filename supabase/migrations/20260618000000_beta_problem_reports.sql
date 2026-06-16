CREATE TABLE IF NOT EXISTS public.beta_problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  problem_type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  contact_email text,
  can_contact boolean NOT NULL DEFAULT false,
  page_url text,
  user_agent text,
  viewport text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid,
  plan text,
  website_id uuid,
  scan_id uuid,
  report_id uuid,
  debug_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  admin_notes text
);

CREATE INDEX IF NOT EXISTS idx_beta_problem_reports_created_at
  ON public.beta_problem_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_problem_reports_status
  ON public.beta_problem_reports (status);
CREATE INDEX IF NOT EXISTS idx_beta_problem_reports_severity
  ON public.beta_problem_reports (severity);
CREATE INDEX IF NOT EXISTS idx_beta_problem_reports_user_id
  ON public.beta_problem_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_beta_problem_reports_org_id
  ON public.beta_problem_reports (org_id);

ALTER TABLE public.beta_problem_reports ENABLE ROW LEVEL SECURITY;

-- No public read/write policies; API uses service_role admin client.

COMMENT ON TABLE public.beta_problem_reports IS
  'Beta feedback and bug reports submitted via Report a Problem widget.';
