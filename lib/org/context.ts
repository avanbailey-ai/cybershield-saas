import { createAdminClient } from '@/lib/supabase/admin';

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  seat_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface OrganizationMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
  organizations?: Organization;
}

/** All organizations the user belongs to (via organization_members). */
export async function getUserOrganizations(userId: string): Promise<OrganizationMembership[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, org_id, user_id, role, created_at, organizations(id, name, owner_id, plan, seat_limit, stripe_customer_id, stripe_subscription_id, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[org/context] getUserOrganizations failed', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    organizations: Array.isArray(row.organizations) ? row.organizations[0] : row.organizations,
  })) as OrganizationMembership[];
}

/** Resolve active org: profiles.default_org_id, else first membership. */
export async function getActiveOrgId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .single();

  if (profile?.default_org_id) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', profile.default_org_id)
      .maybeSingle();

    if (membership) return profile.default_org_id;
  }

  const { data: firstMembership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstMembership?.org_id ?? null;
}

/** Throws if user is not a member of the org. Returns membership role. */
export async function requireOrgMembership(
  userId: string,
  orgId: string,
): Promise<{ role: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) {
    const err = new Error('Forbidden: not a member of this organization');
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  return { role: data.role };
}

/** Fetch organization by id. */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, owner_id, plan, seat_limit, stripe_customer_id, stripe_subscription_id, created_at')
    .eq('id', orgId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Organization;
}
