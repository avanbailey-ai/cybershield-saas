import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canAccessEnterprise, getEffectivePlan, normalizePlan } from '@/lib/auth/permissions';
import { getUserOrgRole } from '@/lib/auth/rbac';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { getActiveOrgId, getOrganization } from '@/lib/org/context';
import { fetchEnterpriseCommandCenterData } from '@/lib/enterprise/fetchEnterpriseCommandCenterData';
import {
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
} from '@/lib/billing/priorityMonitoring';
import { getUserWithPlan } from '@/lib/billing/planService';
import EnterpriseAgencyDashboard from '@/components/enterprise/EnterpriseAgencyDashboard';

export const metadata: Metadata = {
  title: 'Client Protection — CyberShield Enterprise',
};

export default async function EnterpriseDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/enterprise/login?redirectTo=/enterprise/portal');

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );

  if (
    !canAccessEnterprise(
      {
        email: user.email,
        plan: orgCtx.access.plan,
        subscription_status: orgCtx.access.status,
      },
      orgCtx.role,
    )
  ) {
    redirect('/app');
  }

  const orgId = orgCtx.orgId ?? (await getActiveOrgId(user.id));
  const org = orgId ? await getOrganization(orgId) : null;
  const admin = createAdminClient();

  const orgRole = orgCtx.role ?? (orgId ? await getUserOrgRole(user.id, orgId) : null);
  const resolvedPlan = normalizePlan(orgCtx.access.plan);
  const planLabel = PLAN_LIMITS[resolvedPlan]?.name ?? resolvedPlan;
  const isAdmin = orgRole === 'owner' || orgRole === 'admin';

  let prioritySlotsUsed: number | null = null;
  let prioritySlotsLimit: number | null = null;

  if (orgId) {
    const userWithPlan = await getUserWithPlan(user.id, orgId);
    const effectivePlan = getEffectivePlan(userWithPlan);
    prioritySlotsLimit = getPriorityMonitoringSlots(effectivePlan) || null;
    if (prioritySlotsLimit) {
      prioritySlotsUsed = await countPriorityMonitoringUsed(admin, orgId, user.id);
    }
  }

  const data = await fetchEnterpriseCommandCenterData({
    admin,
    orgId,
    userEmail: user.email,
    orgName: org?.name ?? null,
    planLabel,
    isAdmin,
    prioritySlotsUsed,
    prioritySlotsLimit,
  });

  return <EnterpriseAgencyDashboard data={data} />;
}
