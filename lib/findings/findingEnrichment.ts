import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { generateRecommendations } from '@/lib/securityIntelligence/recommendations';

export interface EnrichedFinding {
  findingId: string;
  title: string;
  severity: SecurityFinding['severity'];
  category: SecurityFinding['category'];
  /** Plain-language summary for executives and ticket bodies. */
  summary: string;
  /** Why this matters in business terms. */
  impactBullets: string[];
  /** Deterministic remediation — no AI API required. */
  remediationTitle: string;
  remediationSteps: string[];
  technicalFix: string;
  exploitScenario: string;
}

/** Enrich a scan finding with explanations and deterministic remediation steps. */
export function enrichFinding(finding: SecurityFinding): EnrichedFinding {
  const recommendations = generateRecommendations([finding]);
  const recommendation = recommendations[0];

  return {
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    summary: finding.description,
    impactBullets: finding.impact,
    remediationTitle: recommendation?.title ?? `Fix: ${finding.title}`,
    remediationSteps:
      recommendation?.steps.length ? recommendation.steps : [finding.fix],
    technicalFix: finding.fix,
    exploitScenario: finding.exploitScenario,
  };
}

export function enrichFindings(findings: SecurityFinding[]): EnrichedFinding[] {
  return findings.map(enrichFinding);
}
