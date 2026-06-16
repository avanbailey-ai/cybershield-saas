import { createAdminClient } from '@/lib/supabase/admin';
import type { Plan } from '@/lib/billing/plans';

/** Daily AI report quota per plan. free=0, pro=limited, growth=higher, agency=unlimited. */
export const PLAN_AI_DAILY_LIMITS: Record<Plan, number> = {
  free: 0,
  pro: 5,
  growth: 25,
  agency: Infinity,
  owner: Infinity,
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAiDailyUsage(userId: string | null): Promise<number> {
  if (!userId) return 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_daily_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', todayUtc())
    .maybeSingle();

  if (error) {
    console.warn('[usageLimiter] Failed to read daily usage:', error.message);
    return 0;
  }

  return data?.count ?? 0;
}

export async function incrementAiDailyUsage(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const usageDate = todayUtc();

  const { data: existing } = await supabase
    .from('ai_daily_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .maybeSingle();

  const nextCount = (existing?.count ?? 0) + 1;

  const { error } = await supabase.from('ai_daily_usage').upsert(
    {
      user_id: userId,
      usage_date: usageDate,
      count: nextCount,
    },
    { onConflict: 'user_id,usage_date' },
  );

  if (error) {
    console.warn('[usageLimiter] Failed to increment usage:', error.message);
  }

  return nextCount;
}

export function isWithinAiQuota(plan: Plan, currentUsage: number): boolean {
  const limit = PLAN_AI_DAILY_LIMITS[plan];
  if (limit === Infinity) return true;
  return currentUsage < limit;
}
