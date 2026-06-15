import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { getEffectivePlan, getPlanLimits } from '@/lib/auth/permissions';
import { getEffectiveMaxScansPerDay, getUserWithPlan } from '@/lib/billing/planService';
import { getTodayUtc, getUsage } from '@/lib/billing/usageService';
import { getUserSubscription } from '@/lib/billing/subscriptionService';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [userWithPlan, subscription, scansLimit] = await Promise.all([
      getUserWithPlan(user.id),
      getUserSubscription(user.id),
      getEffectiveMaxScansPerDay(user.id),
    ]);

    const plan = getEffectivePlan(userWithPlan);
    const limits = getPlanLimits(userWithPlan);

    const admin = createAdminClient();
    const { count: websiteCount } = await admin
      .from('websites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const today = getTodayUtc();
    const usage = await getUsage(user.id, today);
    const count = websiteCount ?? 0;

    const websitesRemaining =
      limits.websites === Infinity ? null : Math.max(0, limits.websites - count);

    const scansRemaining =
      scansLimit === Infinity ? Infinity : Math.max(0, scansLimit - usage.scans_used);

    return NextResponse.json({
      plan,
      subscription_status: subscription.status,
      current_period_end: subscription.currentPeriodEnd,
      websiteCount: count,
      scansToday: usage.scans_used,
      limits: PLAN_LIMITS[plan],
      effectiveScansLimit: scansLimit,
      websitesRemaining,
      scansRemaining,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load plan info' }, { status: 500 });
  }
}
