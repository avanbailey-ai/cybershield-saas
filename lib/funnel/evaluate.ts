import type { Plan } from '@/lib/billing/plans';
import type { ScanFunnelInput, ScanFunnelResult, ConversionTier, RecommendedPlan } from './types';

const HIGH_SEVERITY_PATTERN =
  /\b(critical|high severity|high-risk|severely|dangerous|actively exposed|sql injection|xss|rce|remote code|missing ssl|no https|insecure|exposed admin|debug endpoint)\b/i;

const COMPLIANCE_PATTERN =
  /\b(soc\s*2|soc2|sso|saml|audit\s*log|compliance|pci|hipaa|gdpr|api\s*security|penetration|multi-tenant)\b/i;

const CRITICAL_PATTERN =
  /\b(critical|actively exposed|remote code|sql injection|no https|could not reach|exposed admin)\b/i;

export function countHighSeverityIssues(issues: string[]): number {
  return issues.filter((issue) => HIGH_SEVERITY_PATTERN.test(issue)).length;
}

export function countCriticalIssues(issues: string[]): number {
  return issues.filter((issue) => CRITICAL_PATTERN.test(issue)).length;
}

export function hasComplianceFlags(issues: string[]): boolean {
  return issues.some((issue) => COMPLIANCE_PATTERN.test(issue));
}

export function detectNoImprovement(
  currentScore: number,
  priorScore: number | null | undefined,
): boolean {
  if (priorScore == null || Number.isNaN(priorScore)) return false;
  return currentScore <= priorScore;
}

function resolveConversionTier(score: number): ConversionTier {
  if (score >= 70) return 'pro';
  if (score >= 40) return 'smb_urgency';
  return 'enterprise_escalation';
}

function resolveRecommendedPlan(tier: ConversionTier): RecommendedPlan {
  return tier === 'pro' ? 'pro' : 'growth';
}

function buildEnterpriseReviewHref(domain?: string, score?: number): string {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  if (score != null) params.set('score', String(score));
  params.set('source', 'scan_review');
  const qs = params.toString();
  return qs ? `/enterprise/review?${qs}` : '/enterprise/review';
}

/**
 * Score-based 2-tier funnel: SMB primary (/pricing), enterprise secondary (/enterprise/review).
 */
export function evaluateScanFunnel(input: ScanFunnelInput): ScanFunnelResult {
  const { score, riskLevel, issues, domain, priorScore } = input;
  const highCount = countHighSeverityIssues(issues);
  const criticalCount = countCriticalIssues(issues);
  const compliance = hasComplianceFlags(issues);
  const noImprovement = detectNoImprovement(score, priorScore);
  const isCriticalRisk = riskLevel === 'critical' || riskLevel === 'high';

  const triggers: string[] = [];

  const showEnterpriseCta =
    score < 60 || highCount >= 2 || compliance;

  if (score < 60) triggers.push('score_below_60');
  if (highCount >= 2) triggers.push('multiple_high_findings');
  if (compliance) triggers.push('compliance_flags');

  const showEnterpriseReview =
    score < 50 ||
    noImprovement ||
    criticalCount >= 2 ||
    (isCriticalRisk && highCount >= 1);

  if (score < 50) triggers.push('score_below_50');
  if (noImprovement) triggers.push('no_improvement');
  if (criticalCount >= 2) triggers.push('multiple_critical');
  if (isCriticalRisk && highCount >= 1) triggers.push('critical_risk');

  const conversionTier = resolveConversionTier(score);
  const recommendedPlan = resolveRecommendedPlan(conversionTier);
  const enterpriseHref = buildEnterpriseReviewHref(domain, score);

  return {
    segment: showEnterpriseReview ? 'enterprise' : 'smb',
    conversionTier,
    showEnterpriseCta,
    showEnterpriseReview,
    smbPrimaryCta: 'Improve my score automatically',
    smbPrimaryHref: `/pricing?plan=${recommendedPlan}${domain ? `&domain=${encodeURIComponent(domain)}` : ''}`,
    recommendedPlan,
    enterpriseHref,
    topIssuesCount: 3,
    triggers,
  };
}

/** Plan-based product segment for auth routing (no new infrastructure). */
export function getPlanSegment(plan: Plan | string): 'smb' | 'enterprise' | 'growth_nudge' {
  const normalized = plan === 'owner' ? 'agency' : plan;
  if (normalized === 'agency') return 'enterprise';
  if (normalized === 'growth') return 'growth_nudge';
  return 'smb';
}

export function shouldShowGrowthUpgradeNudge(plan: Plan | string): boolean {
  return getPlanSegment(plan) === 'growth_nudge';
}
