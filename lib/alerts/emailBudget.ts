import { createAdminClient } from '@/lib/supabase/admin';
import {
  currentBudgetMonth,
  getBudgetTier,
  isCategoryAllowedAtTier,
  EMAIL_BUDGET,
  type BudgetTier,
  type EmailCategory,
} from './emailTypes';

export interface EmailBudgetSnapshot {
  budgetMonth: string;
  monthlySent: number;
  monthlySkipped: number;
  dailySent: number;
  tier: BudgetTier;
  monthlyRemaining: number;
}

export async function getEmailBudgetSnapshot(): Promise<EmailBudgetSnapshot> {
  const supabase = createAdminClient();
  const budgetMonth = currentBudgetMonth();
  const monthStart = `${budgetMonth}-01T00:00:00.000Z`;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [monthSentRes, monthSkippedRes, daySentRes] = await Promise.all([
    supabase
      .from('email_alert_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', monthStart),
    supabase
      .from('email_alert_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'skipped')
      .gte('created_at', monthStart),
    supabase
      .from('email_alert_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', dayStart.toISOString()),
  ]);

  const monthlySent = monthSentRes.count ?? 0;
  const dailySent = daySentRes.count ?? 0;

  return {
    budgetMonth,
    monthlySent,
    monthlySkipped: monthSkippedRes.count ?? 0,
    dailySent,
    tier: getBudgetTier(monthlySent),
    monthlyRemaining: Math.max(0, EMAIL_BUDGET.monthlyEmailBudget - monthlySent),
  };
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  snapshot: EmailBudgetSnapshot;
}

export async function checkEmailBudget(category: EmailCategory): Promise<BudgetCheckResult> {
  const snapshot = await getEmailBudgetSnapshot();

  if (snapshot.monthlySent >= EMAIL_BUDGET.monthlyEmailBudget) {
    if (category !== 'account_system' && category !== 'billing_system') {
      return { allowed: false, reason: 'monthly_budget_exhausted', snapshot };
    }
  }

  if (!isCategoryAllowedAtTier(category, snapshot.tier)) {
    return { allowed: false, reason: `budget_tier_${snapshot.tier}`, snapshot };
  }

  if (snapshot.dailySent >= EMAIL_BUDGET.dailyHardLimit) {
    if (category !== 'account_system' && category !== 'billing_system' && category !== 'critical_alert') {
      return { allowed: false, reason: 'daily_hard_limit', snapshot };
    }
  }

  if (snapshot.dailySent >= EMAIL_BUDGET.dailySoftLimit) {
    if (
      category === 'weekly_digest' ||
      category === 'monthly_report' ||
      category === 'marketing_onboarding' ||
      category === 'all_clear'
    ) {
      return { allowed: false, reason: 'daily_soft_limit', snapshot };
    }
  }

  return { allowed: true, snapshot };
}
