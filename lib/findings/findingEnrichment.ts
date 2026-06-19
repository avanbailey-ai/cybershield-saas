import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { generateRecommendations } from '@/lib/securityIntelligence/recommendations';
import { explainerForSecurityFinding } from '@/lib/intelligence/catalog';
import type { FindingExplainer, FixDifficulty, UrgencyLevel } from '@/lib/intelligence/types';

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
  /** Rule-based intelligence layer fields */
  plainEnglish: string;
  businessImpact: string;
  recommendedNextStep: string;
  developerMessage: string;
  ownerAction: string;
  urgency: UrgencyLevel;
  difficulty: FixDifficulty;
}

/** Enrich a scan finding with explanations and deterministic remediation steps. */
export function enrichFinding(finding: SecurityFinding): EnrichedFinding {
  const recommendations = generateRecommendations([finding]);
  const recommendation = recommendations[0];
  const explainer: FindingExplainer = explainerForSecurityFinding(finding);

  return {
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    summary: explainer.plainEnglish,
    impactBullets: finding.impact.length > 0 ? finding.impact : [explainer.businessImpact],
    remediationTitle: recommendation?.title ?? `Fix: ${finding.title}`,
    remediationSteps:
      recommendation?.steps.length ? recommendation.steps : [finding.fix],
    technicalFix: finding.fix,
    exploitScenario: finding.exploitScenario,
    plainEnglish: explainer.plainEnglish,
    businessImpact: explainer.businessImpact,
    recommendedNextStep: explainer.recommendedNextStep,
    developerMessage: explainer.developerMessage,
    ownerAction: explainer.ownerAction,
    urgency: explainer.urgency,
    difficulty: explainer.difficulty,
  };
}

export function enrichFindings(findings: SecurityFinding[]): EnrichedFinding[] {
  return findings.map(enrichFinding);
}
