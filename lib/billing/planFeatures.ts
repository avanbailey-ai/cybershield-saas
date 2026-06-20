import type { BilledPlan, Plan } from './plans';
import { PLAN_LIMITS, formatDeepScanLimit } from './plans';

/** Recommended USD prices — checkout uses Stripe Price objects via env vars. */
export const RECOMMENDED_PLAN_PRICES_USD: Record<BilledPlan, number> = {
  pro: 79,
  growth: 149,
  agency: 299,
};

export interface PlanMarketingProfile {
  tagline: string;
  monitoringLabel: string;
  deepScanLabel: string;
  websiteLabel: string;
  bullets: string[];
}

function websiteLabel(count: number): string {
  if (count === Infinity) return 'Custom website limits';
  return `${count} website${count === 1 ? '' : 's'}`;
}

export const PLAN_MARKETING: Record<Plan, PlanMarketingProfile> = {
  free: {
    tagline: 'One-time security preview',
    websiteLabel: '1 website scan',
    monitoringLabel: 'No automated monitoring',
    deepScanLabel: 'One-time preview scan',
    bullets: [
      'Risk score and top findings preview',
      'No account required',
      'Full reports and monitoring require upgrade',
    ],
  },
  pro: {
    tagline: 'Daily monitoring for small businesses',
    websiteLabel: websiteLabel(PLAN_LIMITS.pro.websites),
    monitoringLabel: 'Daily automated monitoring',
    deepScanLabel: `Weekly deep scans · ${formatDeepScanLimit(PLAN_LIMITS.pro.maxScansPerDay)}`,
    bullets: [
      'Full security reports',
      'Email alerts',
      'Daily monitoring checks',
      'Weekly deep scans',
      formatDeepScanLimit(PLAN_LIMITS.pro.maxScansPerDay),
      'Fix guidance & remediation steps',
      'Scan history',
    ],
  },
  growth: {
    tagline: 'Hourly monitoring for growing teams',
    websiteLabel: websiteLabel(PLAN_LIMITS.growth.websites),
    monitoringLabel: 'Hourly automated monitoring',
    deepScanLabel: `Weekly deep scans · ${formatDeepScanLimit(PLAN_LIMITS.growth.maxScansPerDay)}`,
    bullets: [
      'Everything in Pro',
      'Hourly monitoring checks',
      'Change detection',
      'Trend tracking',
      'Priority risk alerts',
      formatDeepScanLimit(PLAN_LIMITS.growth.maxScansPerDay),
    ],
  },
  agency: {
    tagline: 'Multi-client monitoring for agencies',
    websiteLabel: `${PLAN_LIMITS.agency.websites} websites included`,
    monitoringLabel: '25 priority sites every 5 minutes · remaining sites hourly',
    deepScanLabel: 'Weekly deep scans + manual deep scans',
    bullets: [
      '250 websites included',
      '25 priority websites checked every 5 minutes',
      'Remaining websites checked hourly',
      'Client-ready reports',
      'Multi-client dashboard',
      '100 manual deep scans/day',
      'Priority support',
    ],
  },
  owner: {
    tagline: 'Owner agency entitlement',
    websiteLabel: 'Owner access',
    monitoringLabel: 'Agency-grade monitoring enabled',
    deepScanLabel: 'Unlimited manual scans',
    bullets: ['Full platform access', 'Agency monitoring entitlement'],
  },
};

export function getPlanMarketing(plan: Plan): PlanMarketingProfile {
  return PLAN_MARKETING[plan] ?? PLAN_MARKETING.free;
}

export function formatPlanSummary(plan: BilledPlan): string {
  const m = PLAN_MARKETING[plan];
  return `${m.websiteLabel} · ${m.monitoringLabel}`;
}

export const ENTERPRISE_MARKETING = {
  title: 'Enterprise & regulated teams',
  headline: 'Request a Security Review',
  body:
    'For larger organizations, agencies, and compliance-focused teams that need audit trails, SSO support, multi-tenant management, and dedicated security review.',
  pricingNote:
    'No self-serve pricing — we scope coverage around your websites, team structure, compliance needs, and monitoring requirements.',
  bullets: [
    'Audit logs & compliance reporting',
    'Multi-tenant organization management',
    'SSO/SAML implementation path',
    'Dedicated security review & custom SLA',
    'Priority support for regulated environments',
  ],
  cta: 'Request Security Review',
} as const;
