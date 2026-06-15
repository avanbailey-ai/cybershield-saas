-- Enterprise multi-tenant architecture (organizations, RBAC, audit, invites)

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','growth','agency','enterprise')),
  seat_limit INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(org_id);

ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.scan_queue ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.scan_reports ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.scan_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.scan_queue ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.org_invites(org_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select_own ON public.organization_members;
CREATE POLICY org_members_select_own ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS org_members_select_org ON public.organization_members;
CREATE POLICY org_members_select_org ON public.organization_members
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS orgs_select_member ON public.organizations;
CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS websites_select_org ON public.websites;
CREATE POLICY websites_select_org ON public.websites
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

DROP POLICY IF EXISTS scans_select_org ON public.scans;
CREATE POLICY scans_select_org ON public.scans
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

DROP POLICY IF EXISTS alerts_select_org ON public.alerts;
CREATE POLICY alerts_select_org ON public.alerts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

DROP POLICY IF EXISTS audit_logs_select_org ON public.audit_logs;
CREATE POLICY audit_logs_select_org ON public.audit_logs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS org_invites_select ON public.org_invites;
CREATE POLICY org_invites_select ON public.org_invites
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );
