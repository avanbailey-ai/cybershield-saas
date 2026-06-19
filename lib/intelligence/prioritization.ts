import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { explainerForSecurityFinding, getFindingExplainer } from './catalog';
import type {
  FixDifficulty,
  FixThisFirstItem,
  FixThisFirstResult,
  PrioritizationInput,
  UrgencyLevel,
} from './types';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface RankCandidate {
  id: string;
  title: string;
  severity: SecurityFinding['severity'];
  score: number;
  whyItMatters: string;
  difficulty: FixDifficulty;
  ownerAction: string;
  developerAction: string;
  urgency: UrgencyLevel;
}

function operationalCandidates(input: PrioritizationInput): RankCandidate[] {
  const out: RankCandidate[] = [];

  if (input.siteReachable === false) {
    const ex = getFindingExplainer('website_unreachable')!;
    out.push({
      id: 'website_unreachable',
      title: ex.title,
      severity: 'critical',
      score: 1000,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.sslValid === false) {
    const ex = getFindingExplainer('ssl_expired')!;
    out.push({
      id: 'ssl_expired',
      title: ex.title,
      severity: 'critical',
      score: 950,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  } else if (input.sslDaysUntilExpiry != null && input.sslDaysUntilExpiry <= 30) {
    const ex = getFindingExplainer('ssl_expiring')!;
    out.push({
      id: 'ssl_expiring',
      title: ex.title,
      severity: 'high',
      score: 900 - input.sslDaysUntilExpiry,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.domainDaysUntilExpiry != null && input.domainDaysUntilExpiry <= 30) {
    const ex = getFindingExplainer('domain_expiring')!;
    out.push({
      id: 'domain_expiring',
      title: ex.title,
      severity: 'high',
      score: 880 - input.domainDaysUntilExpiry,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.uptimeIssue) {
    const ex = getFindingExplainer('uptime_issue')!;
    out.push({
      id: 'uptime_issue',
      title: ex.title,
      severity: 'high',
      score: 850,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.unexpectedChange) {
    const ex = getFindingExplainer('unexpected_website_change')!;
    out.push({
      id: 'unexpected_website_change',
      title: ex.title,
      severity: 'high',
      score: 820,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.changedHeaders) {
    const ex = getFindingExplainer('changed_headers')!;
    out.push({
      id: 'changed_headers',
      title: ex.title,
      severity: 'high',
      score: 800,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.changedScripts) {
    const ex = getFindingExplainer('changed_scripts')!;
    out.push({
      id: 'changed_scripts',
      title: ex.title,
      severity: 'medium',
      score: 780,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  if (input.mixedContent) {
    const ex = getFindingExplainer('mixed_content')!;
    out.push({
      id: 'mixed_content',
      title: ex.title,
      severity: 'medium',
      score: 760,
      whyItMatters: ex.businessImpact,
      difficulty: ex.difficulty,
      ownerAction: ex.ownerAction,
      developerAction: ex.recommendedNextStep,
      urgency: ex.urgency,
    });
  }

  return out;
}

function findingCandidates(
  findings: PrioritizationInput['findings'],
): RankCandidate[] {
  return findings.map((f) => {
    const ex = getFindingExplainer(f.id);
    const severityRank = SEVERITY_RANK[f.severity] ?? 3;
    const categoryBoost =
      f.category === 'transport' ? 40 : f.category === 'headers' ? 30 : f.category === 'authentication' ? 25 : 10;
    const score = 700 - severityRank * 80 + categoryBoost;

    return {
      id: f.id,
      title: f.title,
      severity: f.severity,
      score,
      whyItMatters:
        ex?.businessImpact ??
        'Fixing this reduces avoidable risk and improves your security score.',
      difficulty: ex?.difficulty ?? (f.severity === 'low' ? 'easy' : 'medium'),
      ownerAction: ex?.ownerAction ?? 'Review this finding and assign to your web developer.',
      developerAction: ex?.recommendedNextStep ?? 'Apply the recommended configuration fix.',
      urgency: ex?.urgency ?? (f.severity === 'critical' ? 'immediate' : f.severity === 'high' ? 'soon' : 'planned'),
    };
  });
}

/** Rule-based priority engine — top 3 issues, no AI tokens. */
export function rankFixThisFirst(input: PrioritizationInput, limit = 3): FixThisFirstResult {
  const all = [...operationalCandidates(input), ...findingCandidates(input.findings)];
  all.sort((a, b) => b.score - a.score || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const seen = new Set<string>();
  const items: FixThisFirstItem[] = [];

  for (const c of all) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    items.push({
      rank: items.length + 1,
      id: c.id,
      title: c.title,
      whyItMatters: c.whyItMatters,
      difficulty: c.difficulty,
      ownerAction: c.ownerAction,
      developerAction: c.developerAction,
      urgency: c.urgency,
      severity: c.severity,
    });
    if (items.length >= limit) break;
  }

  const summary =
    items.length === 0
      ? 'No urgent issues detected — keep monitoring for changes.'
      : items.length === 1
        ? `Start with ${items[0]!.title} — highest impact right now.`
        : `Address ${items.map((i) => i.title).join(', ')} in order for the fastest risk reduction.`;

  return { items, summary };
}

export function rankFixThisFirstFromFindings(
  findings: SecurityFinding[],
  context: Omit<PrioritizationInput, 'findings'> = {},
  limit = 3,
): FixThisFirstResult {
  return rankFixThisFirst(
    {
      ...context,
      findings: findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        category: f.category,
      })),
    },
    limit,
  );
}

export function buildDeveloperHandoff(findings: SecurityFinding[]): string {
  const ranked = rankFixThisFirstFromFindings(findings);
  const lines = [
    'Website security findings — developer handoff',
    'Generated by CyberShield (deterministic report, no AI tokens)',
    '',
    ranked.summary,
    '',
  ];

  for (const item of ranked.items) {
    const ex = explainerForSecurityFinding(
      findings.find((f) => f.id === item.id) ?? {
        id: item.id,
        title: item.title,
        description: item.whyItMatters,
        impact: [item.whyItMatters],
        exploitScenario: item.whyItMatters,
        fix: item.developerAction,
        severity: item.severity,
        category: 'headers',
      },
    );
    lines.push(`## ${item.rank}. ${item.title}`);
    lines.push(ex.developerMessage);
    lines.push('');
  }

  if (ranked.items.length === 0) {
    lines.push('No open findings requiring immediate developer action.');
  }

  return lines.join('\n');
}
