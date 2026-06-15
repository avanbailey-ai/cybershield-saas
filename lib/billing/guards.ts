import { PLAN_LIMITS, type Plan } from './plans';

export type UserWithPlan = {
  id: string;
  plan?: string | null;
};

export function getUserPlan(user: UserWithPlan): Plan {
  const plan = user.plan as Plan;
  if (plan && plan in PLAN_LIMITS) return plan;
  return 'pro';
}

export function getPlanLimits(user: UserWithPlan) {
  return PLAN_LIMITS[getUserPlan(user)];
}

export function canAddWebsite(
  user: UserWithPlan,
  currentWebsiteCount: number,
): { allowed: boolean; message?: string } {
  const limits = getPlanLimits(user);
  if (currentWebsiteCount >= limits.websites) {
    const plan = getUserPlan(user);
    const upgrade = plan === 'pro' ? 'Growth' : plan === 'growth' ? 'Agency' : null;
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
    const upgrade = plan === 'pro' ? 'Growth' : plan === 'growth' ? 'Agency' : null;
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
  return `${current} / ${limits.websites} websites used`;
}
