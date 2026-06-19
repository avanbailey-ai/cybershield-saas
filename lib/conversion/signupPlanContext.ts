import type { BilledPlan } from '@/lib/billing/plans';
import { RECOMMENDED_PLAN_PRICES_USD, getPlanMarketing } from '@/lib/billing/planFeatures';
import { isValidAttributionToken } from '@/lib/owner/prospectAttribution';

export type SignupPlanParam = BilledPlan | null;

const VALID_PLANS = new Set<string>(['pro', 'growth', 'agency']);

export function parseSignupPlanParam(raw: string | null | undefined): SignupPlanParam {
  const plan = raw?.trim().toLowerCase();
  if (plan && VALID_PLANS.has(plan)) return plan as BilledPlan;
  return null;
}

export interface SignupAttributionParams {
  plan: SignupPlanParam;
  source: string | null;
  prospectToken: string | null;
  hasValidProspect: boolean;
}

export function parseSignupAttributionParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): SignupAttributionParams {
  const plan = parseSignupPlanParam(searchParams.get('plan'));
  const source = searchParams.get('source')?.trim() || null;
  const refParam = searchParams.get('ref');
  const refToken =
    refParam?.startsWith('prospect_') ? refParam.slice('prospect_'.length) : null;
  const prospectRaw = searchParams.get('prospect') ?? refToken;
  const prospectToken =
    prospectRaw && isValidAttributionToken(prospectRaw) ? prospectRaw : null;

  return {
    plan,
    source,
    prospectToken,
    hasValidProspect: Boolean(prospectToken),
  };
}

export function signupPlanPrice(plan: BilledPlan): number {
  return RECOMMENDED_PLAN_PRICES_USD[plan];
}

export interface SignupPlanCopy {
  title: string;
  subtitle: string;
  panelHeadline: string;
  panelDescription: string;
  panelBullets: string[];
  planBadge: string | null;
  planHighlight: string | null;
}

export function signupPlanCopy(plan: SignupPlanParam): SignupPlanCopy {
  const defaultCopy: SignupPlanCopy = {
    title: 'Create your account',
    subtitle: 'Start with a free scan or set up continuous monitoring.',
    panelHeadline: 'Start Protecting Your Websites',
    panelDescription: 'Create your account, then scan your first site in under 30 seconds.',
    panelBullets: [
      'Health Center for every website',
      'SSL & domain expiry monitoring',
      'Change timeline & email alerts',
      'Daily to hourly monitoring (by plan)',
    ],
    planBadge: null,
    planHighlight: null,
  };

  if (!plan) return defaultCopy;

  const price = signupPlanPrice(plan);
  const marketing = getPlanMarketing(plan);

  if (plan === 'agency') {
    return {
      title: 'Start agency monitoring',
      subtitle: `Create your account to monitor client websites on the Agency plan ($${price}/mo).`,
      panelHeadline: 'Monitoring infrastructure for client websites',
      panelDescription:
        'CyberShield Cloud helps agencies catch SSL, domain, security, uptime, and change issues before clients notice — with client-ready reports.',
      panelBullets: [
        'Monitor up to 250 client websites',
        'Priority checks for critical client sites',
        'Monthly client-ready security reports',
        'One dashboard for your entire portfolio',
        'Fits care plans and maintenance retainers',
      ],
      planBadge: 'Agency plan',
      planHighlight: `$${price}/mo · ${marketing.websiteLabel}`,
    };
  }

  if (plan === 'growth') {
    return {
      ...defaultCopy,
      title: 'Enable continuous protection',
      subtitle: `Create your account for Growth monitoring ($${price}/mo).`,
      panelHeadline: 'Hourly monitoring for growing teams',
      panelDescription: marketing.tagline,
      panelBullets: marketing.bullets,
      planBadge: 'Growth plan',
      planHighlight: `$${price}/mo · ${marketing.monitoringLabel}`,
    };
  }

  return {
    ...defaultCopy,
    title: 'Start monitoring your site',
    subtitle: `Create your account for Pro monitoring ($${price}/mo).`,
    panelHeadline: 'Daily monitoring for your website',
    panelDescription: marketing.tagline,
    panelBullets: marketing.bullets,
    planBadge: 'Pro plan',
    planHighlight: `$${price}/mo · ${marketing.monitoringLabel}`,
  };
}

export function appendAttributionQuery(
  basePath: string,
  params: { plan?: string | null; source?: string | null; prospect?: string | null },
): string {
  const q = new URLSearchParams();
  if (params.plan) q.set('plan', params.plan);
  if (params.source) q.set('source', params.source);
  if (params.prospect && isValidAttributionToken(params.prospect)) {
    q.set('prospect', params.prospect);
  }
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
