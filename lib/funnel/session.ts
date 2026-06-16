'use client';

export const FUNNEL_KEYS = {
  scanned_site: 'cybershield_funnel_scanned_site',
  score: 'cybershield_funnel_score',
  risk_level: 'cybershield_funnel_risk_level',
  issue_count: 'cybershield_funnel_issue_count',
} as const;

export interface FunnelSessionState {
  scanned_site: string;
  score: number;
  risk_level: string;
  issue_count: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function saveFunnelSession(state: FunnelSessionState): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(FUNNEL_KEYS.scanned_site, state.scanned_site);
  sessionStorage.setItem(FUNNEL_KEYS.score, String(state.score));
  sessionStorage.setItem(FUNNEL_KEYS.risk_level, state.risk_level);
  sessionStorage.setItem(FUNNEL_KEYS.issue_count, String(state.issue_count));
  // Legacy key used by PlanComparisonTable
  sessionStorage.setItem('cybershield_last_score', String(state.score));
}

export function readFunnelSession(): FunnelSessionState | null {
  if (!isBrowser()) return null;

  const scanned_site = sessionStorage.getItem(FUNNEL_KEYS.scanned_site);
  const scoreRaw = sessionStorage.getItem(FUNNEL_KEYS.score);
  const risk_level = sessionStorage.getItem(FUNNEL_KEYS.risk_level);
  const issueRaw = sessionStorage.getItem(FUNNEL_KEYS.issue_count);

  if (!scanned_site || scoreRaw == null) return null;

  const score = parseInt(scoreRaw, 10);
  const issue_count = issueRaw != null ? parseInt(issueRaw, 10) : 0;

  if (Number.isNaN(score)) return null;

  return {
    scanned_site,
    score,
    risk_level: risk_level ?? 'unknown',
    issue_count: Number.isNaN(issue_count) ? 0 : issue_count,
  };
}

export function buildPricingHref(
  plan: 'pro' | 'growth' = 'pro',
  overrides?: Partial<FunnelSessionState>,
): string {
  const stored = readFunnelSession();
  const state = stored ? { ...stored, ...overrides } : overrides;

  const params = new URLSearchParams();
  params.set('plan', plan);

  if (state?.scanned_site) params.set('domain', state.scanned_site);
  if (state?.score != null) params.set('score', String(state.score));
  if (state?.issue_count != null) params.set('issues', String(state.issue_count));
  if (state?.risk_level) params.set('risk', state.risk_level);

  return `/pricing?${params.toString()}`;
}

export function parseFunnelFromSearchParams(
  searchParams: URLSearchParams,
): FunnelSessionState | null {
  const domain = searchParams.get('domain');
  const scoreRaw = searchParams.get('score');
  if (!domain || !scoreRaw) return readFunnelSession();

  const score = parseInt(scoreRaw, 10);
  if (Number.isNaN(score)) return readFunnelSession();

  const issuesRaw = searchParams.get('issues');
  const issue_count = issuesRaw != null ? parseInt(issuesRaw, 10) : 0;

  const state: FunnelSessionState = {
    scanned_site: domain,
    score,
    risk_level: searchParams.get('risk') ?? 'unknown',
    issue_count: Number.isNaN(issue_count) ? 0 : issue_count,
  };

  saveFunnelSession(state);
  return state;
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
