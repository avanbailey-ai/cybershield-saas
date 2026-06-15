-- Fix infinite recursion in organization_members RLS policies.
-- Root cause: org_members_select_org subqueries organization_members inside its own policies.
-- Safe pattern: authenticated users read only their own membership rows (user_id = auth.uid()).
-- Team member listing and writes use service role (admin client), which bypasses RLS.

-- Phase 1: Drop all existing policies on organization_members
DROP POLICY IF EXISTS org_members_select_org ON public.organization_members;
DROP POLICY IF EXISTS org_members_select_own ON public.organization_members;

-- Phase 2: Reset RLS
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Phase 3: Create flat non-recursive SELECT policy only
CREATE POLICY org_members_select_own ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
