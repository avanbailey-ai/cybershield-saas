import { isOwner } from './owner';
import { PLAN_LIMITS, type Plan } from '@/lib/billing/plans';
import { canAccessFeature, type UserForFeatureGate } from './featureGate';
import type { OrgRole } from '@/lib/auth/rbac';
import { isOrgAdminRole } from '@/lib/auth/rbac';

export type UserWithPlan = {
  id?: string;
  email?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
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

/** Effective plan for limits — owner email always gets agency-tier limits. */
export function getEffectivePlan(user: UserWithPlan): Plan {
  if (isOwner(user.email)) return 'agency';
  const plan = normalizePlan(user.plan);
  if (plan === 'owner') return 'agency';
  return plan;
}

export function canAccessDashboard(user: UserForFeatureGate): boolean {
  return canAccessFeature(user, 'dashboard');
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
  maxScansOverride?: number,
): { allowed: boolean; message?: string } {
  if (isOwner(user.email)) return { allowed: true };

  const limits = getPlanLimits(user);
  const maxScans = maxScansOverride ?? limits.maxScansPerDay;
  if (scansToday >= maxScans) {
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
        : `You've reached your daily scan limit (${maxScans})`,
    };
  }
  return { allowed: true };
}

export function canUseMonitoring(user: UserForFeatureGate): boolean {
  return canAccessFeature(user, 'monitoring');
}

const ENTERPRISE_PLANS = new Set<Plan>(['agency', 'growth']);

/** Enterprise portal: active agency/growth org subscription + org owner or admin. */
export function canAccessEnterprise(
  user: UserForFeatureGate,
  orgRole?: OrgRole | null,
): boolean {
  if (!orgRole || !isOrgAdminRole(orgRole)) return false;

  const plan = normalizePlan(user.plan);
  const status = user.subscription_status ?? 'inactive';
  const isActive = status === 'active' || status === 'trialing';

  if (!isActive || !ENTERPRISE_PLANS.has(plan)) return false;

  return true;
}

export function getWebsiteUsageMessage(current: number, user: UserWithPlan): string {
  const limits = getPlanLimits(user);
  if (limits.websites === Infinity) {
    return `${current} websites (unlimited)`;
  }
  return `${current} / ${limits.websites} websites used`;
}
