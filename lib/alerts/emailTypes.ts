/** Production email categories and budget configuration. */

export type EmailCategory =
  | 'account_system'
  | 'billing_system'
  | 'critical_alert'
  | 'weekly_digest'
  | 'monthly_report'
  | 'admin_digest'
  | 'marketing_onboarding'
  | 'all_clear';

/** Lower index = higher priority when budget is tight. */
export const EMAIL_CATEGORY_PRIORITY: EmailCategory[] = [
  'account_system',
  'billing_system',
  'critical_alert',
  'admin_digest',
  'monthly_report',
  'weekly_digest',
  'marketing_onboarding',
  'all_clear',
];

export const EMAIL_BUDGET = {
  monthlyEmailBudget: 3000,
  dailySoftLimit: 90,
  dailyHardLimit: 100,
  monthlyWarningThreshold: 2400,
  monthlyRestrictedThreshold: 2800,
  monthlyHardStop: 2950,
} as const;

export type BudgetTier = 'normal' | 'warning' | 'restricted' | 'hard_stop' | 'exhausted';

export function getBudgetTier(monthlySent: number): BudgetTier {
  if (monthlySent >= EMAIL_BUDGET.monthlyEmailBudget) return 'exhausted';
  if (monthlySent >= EMAIL_BUDGET.monthlyHardStop) return 'hard_stop';
  if (monthlySent >= EMAIL_BUDGET.monthlyRestrictedThreshold) return 'restricted';
  if (monthlySent >= EMAIL_BUDGET.monthlyWarningThreshold) return 'warning';
  return 'normal';
}

/** Whether this email category may send at the current budget tier. */
export function isCategoryAllowedAtTier(category: EmailCategory, tier: BudgetTier): boolean {
  if (tier === 'exhausted') {
    return category === 'account_system' || category === 'billing_system';
  }
  if (tier === 'hard_stop') {
    return category === 'account_system' || category === 'billing_system' || category === 'critical_alert';
  }
  if (tier === 'restricted') {
    return (
      category === 'account_system' ||
      category === 'billing_system' ||
      category === 'critical_alert' ||
      category === 'admin_digest' ||
      category === 'monthly_report'
    );
  }
  if (tier === 'warning') {
    return category !== 'marketing_onboarding' && category !== 'all_clear';
  }
  return true;
}

export function currentBudgetMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function categoryPriority(category: EmailCategory): number {
  const idx = EMAIL_CATEGORY_PRIORITY.indexOf(category);
  return idx === -1 ? 999 : idx;
}
