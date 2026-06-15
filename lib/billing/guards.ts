import { PLAN_LIMITS, type Plan } from './plans';

export type UserWithPlan = {
  id: string;
  plan?: string | null;
};

const LEGACY_PLAN_MAP: Record<string, Plan> = {
  starter: 'pro',
  business: 'pro',
};

export function normalizePlan(raw: string | null | undefined): Plan {
  if (!raw) return 'free';
  if (raw in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[raw];
  if (raw in PLAN_LIMITS) return raw as Plan;
  return 'free';
}

export function getUserPlan(user: UserWithPlan): Plan {
  return normalizePlan(user.plan);
}

export function getPlanLimits(user: UserWithPlan) {
  return PLAN_LIMITS[getUserPlan(user)];
}

export function canAddWebsite(
  user: UserWithPlan,
  currentWebsiteCount: number,
): { allowed: boolean; message?: string } {
  const limits = getPlanLimits(user);
  if (limits.websites !== Infinity && currentWebsiteCount >= limits.websites) {
    const plan = getUserPlan(user);
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
  const limits = getPlanLimits(user);
  if (scansToday >= limits.maxScansPerDay) {
    const plan = getUserPlan(user);
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

export function getWebsiteUsageMessage(current: number, user: UserWithPlan): string {
  const limits = getPlanLimits(user);
  if (limits.websites === Infinity) {
    return `${current} websites (unlimited)`;
  }
  return `${current} / ${limits.websites} websites used`;
}
