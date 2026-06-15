import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { getUserPlan, getPlanLimits } from '@/lib/billing/guards';
import { getUsage } from '@/lib/billing/usageService';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const userWithPlan = { id: user.id, plan: profile?.plan ?? null };
    const plan = getUserPlan(userWithPlan);
    const limits = getPlanLimits(userWithPlan);

    const admin = createAdminClient();
    const { count: websiteCount } = await admin
      .from('websites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const today = new Date().toISOString().split('T')[0];
    const usage = await getUsage(user.id, today);
    const count = websiteCount ?? 0;

    return NextResponse.json({
      plan,
      websiteCount: count,
      scansToday: usage.scans_used,
      limits: PLAN_LIMITS[plan],
      websitesRemaining: Math.max(0, limits.websites - count),
      scansRemaining: Math.max(0, limits.maxScansPerDay - usage.scans_used),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load plan info' }, { status: 500 });
  }
}
