import { isOwner } from './owner';
import { PLAN_LIMITS, type Plan } from '@/lib/billing/plans';

export type UserWithPlan = {
  id?: string;
  email?: string | null;
  plan?: string | null;
};

const LEGACY_PLAN_MAP: Record<string, Plan> = {
  starter: 'pro',
  business: 'pro',
};

const PAID_DASHBOARD_PLANS = ['pro', 'growth', 'agency', 'owner'] as const;

export function normalizePlan(raw: string | null | undefined): Plan {
  if (!raw) return 'free';
  if (raw in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[raw];
  if (raw in PLAN_LIMITS) return raw as Plan;
  return 'free';
}

/** Effective plan for limits — owner email always gets agency-tier limits. */
export function getEffectivePlan(user: UserWithPlan): Plan {
  if (isOwner(user.email)) return 'agency';
  const plan = normalizePlan(user.plan);
  if (plan === 'owner') return 'agency';
  return plan;
}

export function canAccessDashboard(user: UserWithPlan): boolean {
  if (isOwner(user.email)) return true;
  return PAID_DASHBOARD_PLANS.includes(
    (user.plan ?? 'free') as (typeof PAID_DASHBOARD_PLANS)[number],
  );
}

export function getUserPlan(user: UserWithPlan): Plan {
  return getEffectivePlan(user);
}

export function getPlanLimits(user: UserWithPlan) {
  const plan = getEffectivePlan(user);
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  return {
    websites: limits.websites,
    maxWebsites: limits.websites,
    maxScansPerDay: limits.maxScansPerDay,
    scanFrequency: limits.scanFrequency,
  };
}

export function canAddWebsite(
  user: UserWithPlan,
  currentWebsiteCount: number,
): { allowed: boolean; message?: string } {
  if (isOwner(user.email)) return { allowed: true };

  const limits = getPlanLimits(user);
  if (limits.websites !== Infinity && currentWebsiteCount >= limits.websites) {
    const plan = getEffectivePlan(user);
    const upgrade =
      plan === 'free'
        ? 'Pro'
        : plan === 'pro'
          ? 'Growth'
          : plan === 'growth'
            ? 'Agency'
            : null;
    return {
      allowed: false,
      message: upgrade
        ? `Upgrade to ${upgrade} to add more websites`
        : `You've reached your website limit (${limits.websites})`,
    };
  }
  return { allowed: true };
}

export function canRunScan(
  user: UserWithPlan,
  scansToday: number,
): { allowed: boolean; message?: string } {
  if (isOwner(user.email)) return { allowed: true };

  const limits = getPlanLimits(user);
  if (scansToday >= limits.maxScansPerDay) {
    const plan = getEffectivePlan(user);
    const upgrade =
      plan === 'free'
        ? 'Pro'
        : plan === 'pro'
          ? 'Growth'
          : plan === 'growth'
            ? 'Agency'
            : null;
    return {
      allowed: false,
      message: upgrade
        ? `Upgrade to ${upgrade} for more daily scans`
        : `You've reached your daily scan limit (${limits.maxScansPerDay})`,
    };
  }
  return { allowed: true };
}

export function canUseMonitoring(user: UserWithPlan): boolean {
  if (isOwner(user.email)) return true;
  return PAID_DASHBOARD_PLANS.includes(
    (user.plan ?? 'free') as (typeof PAID_DASHBOARD_PLANS)[number],
  );
}

export function getWebsiteUsageMessage(current: number, user: UserWithPlan): string {
  const limits = getPlanLimits(user);
  if (limits.websites === Infinity) {
    return `${current} websites (unlimited)`;
  }
  return `${current} / ${limits.websites} websites used`;
}
