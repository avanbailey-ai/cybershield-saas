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
      'Up to 10 websites',
      'Daily monitoring',
      'Weekly deep scans',
      'Full reports',
      'Email alerts',
      'Remediation guidance',
      'Scan history',
      formatDeepScanLimit(PLAN_LIMITS.pro.maxScansPerDay),
    ],
  },
  growth: {
    tagline: 'Hourly monitoring for growing teams',
    websiteLabel: websiteLabel(PLAN_LIMITS.growth.websites),
    monitoringLabel: 'Hourly automated monitoring',
    deepScanLabel: `Weekly deep scans · ${formatDeepScanLimit(PLAN_LIMITS.growth.maxScansPerDay)}`,
    bullets: [
      'Up to 50 websites',
      'Hourly monitoring',
      'Weekly deep scans',
      'Change detection',
      'Trend tracking',
      'Priority alerts',
      formatDeepScanLimit(PLAN_LIMITS.growth.maxScansPerDay),
    ],
  },
  agency: {
    tagline: 'Multi-client monitoring for agencies',
    websiteLabel: `${PLAN_LIMITS.agency.websites} websites included`,
    monitoringLabel: '25 priority sites every 5 minutes · remaining sites hourly',
    deepScanLabel: 'Weekly deep scans + manual deep scans',
    bullets: [
      'Up to 250 websites',
      'Agency dashboard',
      'Client-ready reports',
      'Portfolio monitoring',
      'Priority monitoring slots',
      'Client website organization',
      formatDeepScanLimit(PLAN_LIMITS.agency.maxScansPerDay),
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
  headline: 'Custom monitoring for larger organizations',
  body:
    'For teams that need larger limits, custom reporting, organization controls, and priority support — scoped to your websites and compliance needs.',
  pricingNote: 'Custom pricing. Contact sales to discuss coverage, limits, and security review workflows.',
  bullets: [
    'Security review workflows',
    'Larger website and scan limits',
    'Custom reporting',
    'Priority support',
    'Organization controls',
    'Audit-friendly scan history for internal review',
  ],
  cta: 'Contact Sales',
} as const;
