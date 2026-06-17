import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { getPlanLimits, normalizePlan, getEffectivePlan } from '@/lib/auth/permissions';
import {
  canUsePriorityMonitoring,
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
} from '@/lib/billing/priorityMonitoring';
import { getEffectiveMaxScansPerDay, getUserWithPlan } from '@/lib/billing/planService';
import { getTodayUtc, getUsage } from '@/lib/billing/usageService';
import { getActiveOrgId } from '@/lib/org/context';
import { getOrgSubscription } from '@/lib/billing/orgSubscriptionService';
import { getUserOrgRole } from '@/lib/auth/rbac';
import { isOrgAdminRole } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getActiveOrgId(user.id);

    const [userWithPlan, orgSubscription, scansLimit, orgRole] = await Promise.all([
      getUserWithPlan(user.id, orgId, user.email),
      orgId ? getOrgSubscription(orgId) : Promise.resolve(null),
      getEffectiveMaxScansPerDay(user.id, orgId),
      orgId ? getUserOrgRole(user.id, orgId) : Promise.resolve(null),
    ]);

    const plan = normalizePlan(userWithPlan.plan);
    const effectivePlan = getEffectivePlan(userWithPlan);
    const limits = getPlanLimits(userWithPlan);

    const admin = createAdminClient();
    let websiteCountQuery = admin
      .from('websites')
      .select('id', { count: 'exact', head: true });
    websiteCountQuery = orgId
      ? websiteCountQuery.eq('org_id', orgId)
      : websiteCountQuery.eq('user_id', user.id);
    const { count: websiteCount } = await websiteCountQuery;

    const today = getTodayUtc();
    const usage = await getUsage(user.id, today);
    const count = websiteCount ?? 0;

    const websitesRemaining =
      limits.websites === Infinity ? null : Math.max(0, limits.websites - count);

    const scansRemaining =
      scansLimit === Infinity ? Infinity : Math.max(0, scansLimit - usage.scans_used);

    let priorityMonitoring: {
      eligible: boolean;
      limit: number;
      used: number;
    } | null = null;

    if (canUsePriorityMonitoring(userWithPlan)) {
      const used = await countPriorityMonitoringUsed(admin, orgId, user.id);
      priorityMonitoring = {
        eligible: true,
        limit: getPriorityMonitoringSlots(effectivePlan),
        used,
      };
    }

    return NextResponse.json(
      {
        plan,
        effectivePlan,
        subscription_status: userWithPlan.subscription_status ?? orgSubscription?.status ?? 'inactive',
        current_period_end: orgSubscription?.currentPeriodEnd ?? null,
        orgId,
        orgRole,
        canManageOrg: orgRole ? isOrgAdminRole(orgRole) : false,
        websiteCount: count,
        scansToday: usage.scans_used,
        limits: PLAN_LIMITS[plan],
        effectiveScansLimit: scansLimit,
        websitesRemaining,
        scansRemaining,
        priorityMonitoring,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load plan info' }, { status: 500 });
  }
}
