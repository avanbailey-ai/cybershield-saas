import type { HeaderChecks } from '@/lib/scanner/runScan';
import { SEVERITY_DEDUCTIONS } from '@/lib/securityIntelligence/scoring';
import type {
  FindingCategory,
  SecurityFinding,
  SecurityIntelligenceReport,
  Severity,
} from '@/lib/securityIntelligence/types';
import {
  formatRelativeScanTime,
  securityScoreBand,
  securityScorePresentation,
  securityTrend,
  type SecurityTrend,
} from '@/lib/websiteHealth/healthCenterCopy';

export type ReportViewMode = 'executive' | 'technical';

export type BusinessImpactLevel = 'low' | 'moderate' | 'high';
export type EffortLevel = 'easy' | 'moderate' | 'advanced';

export interface EffortEstimate {
  level: EffortLevel;
  label: string;
  timeRange: string;
  expertise: string;
}

export interface BusinessImpactInfo {
  level: BusinessImpactLevel;
  label: string;
  ifIgnored: string;
}

export interface ScoreImpactPreview {
  currentScore: number;
  projectedScore: number;
  estimatedGain: number;
}

export interface FindingExecutiveView {
  findingId: string;
  title: string;
  severity: Severity;
  categoryGroup: string;
  businessSummary: string;
  businessImpact: BusinessImpactInfo;
  effort: EffortEstimate;
  scoreImpact: ScoreImpactPreview;
  technicalExplanation: string;
}

export interface FixFirstAction {
  rank: number;
  findingId: string;
  title: string;
  estimatedGain: number;
  effort: EffortEstimate;
  projectedScore: number;
}

export interface FixTheseFirstSummary {
  actions: FixFirstAction[];
  totalEstimatedGain: number;
  totalEffortLabel: string;
  potentialImprovement: string;
}

export interface BusinessImpactGroup {
  name: string;
  description: string;
  findings: FindingExecutiveView[];
}

export interface SecurityStrength {
  label: string;
  detail: string;
}

export interface WeeklyPlanItem {
  week: number;
  title: string;
  tasks: string[];
}

export interface ExecutiveSummary {
  headline: string;
  statusBullets: string[];
  overallRisk: string;
  nextStep: string;
}

export interface SecurityScoreExplanation {
  score: number;
  band: string;
  percentileContext: string;
  scoreDrivers: string[];
  positiveFactors: string[];
}

export interface SecurityProgress {
  lastScanLabel: string;
  bestScore: number | null;
  currentScore: number;
  trend: SecurityTrend;
}

export interface ExecutiveReportPresentation {
  summary: ExecutiveSummary;
  scoreExplanation: SecurityScoreExplanation;
  fixTheseFirst: FixTheseFirstSummary;
  strengths: SecurityStrength[];
  groupedFindings: BusinessImpactGroup[];
  plan: WeeklyPlanItem[];
  progress: SecurityProgress;
  findingViews: FindingExecutiveView[];
}

export const BANNED_REPORT_PHRASES = [
  'item(s) to review',
  '[CRITICAL]',
  '[HIGH]',
  '[MEDIUM]',
  '[LOW]',
  'Security Intelligence Findings',
] as const;

export const REQUIRED_REPORT_PHRASES = [
  'Executive Summary',
  'Fix These First',
  'Business Impact',
  'Below average',
  'If ignored',
  'Security Strengths',
  '30-Day Security Improvement Plan',
  'Security Progress',
  'Technical Explanation',
  'Executive view',
  'Technical view',
] as const;

const CATEGORY_GROUP: Record<FindingCategory, { name: string; description: string }> = {
  headers: {
    name: 'Browser Security Protections',
    description:
      'Headers that tell browsers how to protect visitors from common web attacks like clickjacking and data theft.',
  },
  transport: {
    name: 'Connection & Encryption',
    description:
      'How securely data travels between your visitors and your website — the foundation of customer trust.',
  },
  third_party: {
    name: 'Third-Party Dependencies',
    description:
      'External scripts and services loaded by your site that can expand risk if not reviewed.',
  },
  authentication: {
    name: 'Login & Account Safety',
    description:
      'How login forms and account flows are exposed and whether they follow safe practices.',
  },
  attack_surface: {
    name: 'Website Exposure',
    description:
      'Public pages, endpoints, and forms that increase what attackers can discover or target.',
  },
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function businessImpactFromSeverity(severity: Severity): BusinessImpactInfo {
  if (severity === 'critical' || severity === 'high') {
    return {
      level: 'high',
      label: 'High Business Impact',
      ifIgnored:
        'Visitors may see security warnings, lose trust, or expose credentials. Competitors and regulators notice gaps faster than you might expect.',
    };
  }
  if (severity === 'medium') {
    return {
      level: 'moderate',
      label: 'Moderate Business Impact',
      ifIgnored:
        'Risk compounds over time — a minor gap today can become the entry point for a larger incident after your next site update.',
    };
  }
  return {
    level: 'low',
    label: 'Low Business Impact',
    ifIgnored:
      'Unlikely to cause immediate harm, but fixing it strengthens your baseline and makes future audits smoother.',
  };
}

function effortForFinding(category: FindingCategory, severity: Severity): EffortEstimate {
  if (category === 'headers') {
    return {
      level: 'easy',
      label: 'Easy',
      timeRange: '15–30 minutes',
      expertise: 'Website admin or developer with hosting access',
    };
  }
  if (category === 'transport') {
    return {
      level: severity === 'critical' ? 'moderate' : 'easy',
      label: severity === 'critical' ? 'Moderate' : 'Easy',
      timeRange: severity === 'critical' ? '1–2 hours' : '30–60 minutes',
      expertise: 'Hosting provider or IT contact',
    };
  }
  if (category === 'third_party') {
    return {
      level: 'moderate',
      label: 'Moderate',
      timeRange: '1–3 hours',
      expertise: 'Developer familiar with your site’s scripts and vendors',
    };
  }
  if (category === 'authentication') {
    return {
      level: 'moderate',
      label: 'Moderate',
      timeRange: '2–4 hours',
      expertise: 'Developer or security-aware web admin',
    };
  }
  return {
    level: severity === 'low' ? 'easy' : 'moderate',
    label: severity === 'low' ? 'Easy' : 'Moderate',
    timeRange: severity === 'low' ? '30 minutes' : '1–2 hours',
    expertise: 'Developer or site owner with CMS access',
  };
}

function scoreImpactForFinding(currentScore: number, severity: Severity): ScoreImpactPreview {
  const gain = SEVERITY_DEDUCTIONS[severity];
  const projected = Math.min(100, currentScore + gain);
  return {
    currentScore,
    projectedScore: projected,
    estimatedGain: projected - currentScore,
  };
}

function businessSummaryFromFinding(finding: SecurityFinding): string {
  const firstImpact = finding.impact[0];
  if (firstImpact && firstImpact.length < 120) {
    return firstImpact;
  }
  return finding.description;
}

function technicalExplanationFromFinding(finding: SecurityFinding): string {
  const parts = [finding.description];
  if (finding.impact.length > 0) {
    parts.push(finding.impact.join(' '));
  }
  parts.push(finding.exploitScenario);
  return parts.join(' ');
}

export function buildFindingExecutiveView(
  finding: SecurityFinding,
  currentScore: number,
): FindingExecutiveView {
  const group = CATEGORY_GROUP[finding.category];
  return {
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    categoryGroup: group.name,
    businessSummary: businessSummaryFromFinding(finding),
    businessImpact: businessImpactFromSeverity(finding.severity),
    effort: effortForFinding(finding.category, finding.severity),
    scoreImpact: scoreImpactForFinding(currentScore, finding.severity),
    technicalExplanation: technicalExplanationFromFinding(finding),
  };
}

export function groupFindingsByBusinessImpact(
  findingViews: FindingExecutiveView[],
): BusinessImpactGroup[] {
  const byName = new Map<string, BusinessImpactGroup>();

  for (const view of findingViews) {
    const meta = Object.values(CATEGORY_GROUP).find((g) => g.name === view.categoryGroup);
    const existing = byName.get(view.categoryGroup);
    if (existing) {
      existing.findings.push(view);
    } else {
      byName.set(view.categoryGroup, {
        name: view.categoryGroup,
        description: meta?.description ?? '',
        findings: [view],
      });
    }
  }

  return Array.from(byName.values()).map((group) => ({
    ...group,
    findings: [...group.findings].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    ),
  }));
}

export function buildFixTheseFirst(
  findingViews: FindingExecutiveView[],
  currentScore: number,
): FixTheseFirstSummary {
  const ranked = [...findingViews]
    .sort((a, b) => {
      const gainDiff = b.scoreImpact.estimatedGain - a.scoreImpact.estimatedGain;
      if (gainDiff !== 0) return gainDiff;
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    })
    .slice(0, 3);

  const actions: FixFirstAction[] = ranked.map((view, index) => ({
    rank: index + 1,
    findingId: view.findingId,
    title: view.title,
    estimatedGain: view.scoreImpact.estimatedGain,
    effort: view.effort,
    projectedScore: view.scoreImpact.projectedScore,
  }));

  const totalGain = actions.reduce((sum, a) => sum + a.estimatedGain, 0);
  const projectedTotal = Math.min(100, currentScore + totalGain);

  const effortLevels = new Set(actions.map((a) => a.effort.level));
  let totalEffortLabel = 'Low effort overall';
  if (effortLevels.has('advanced')) {
    totalEffortLabel = 'Mixed effort — plan developer time';
  } else if (effortLevels.has('moderate')) {
    totalEffortLabel = 'Moderate effort — a focused afternoon';
  }

  return {
    actions,
    totalEstimatedGain: totalGain,
    totalEffortLabel,
    potentialImprovement: `Addressing these ${actions.length} item${actions.length === 1 ? '' : 's'} could raise your score to about ${projectedTotal}/100.`,
  };
}

export function extractSecurityStrengths(
  passed: string[],
  headers: HeaderChecks | null,
  sslValid: boolean | null,
  findings: SecurityFinding[],
): SecurityStrength[] {
  const strengths: SecurityStrength[] = [];

  if (sslValid) {
    strengths.push({
      label: 'HTTPS enabled',
      detail: 'Visitor traffic is encrypted — a core trust signal for customers and search engines.',
    });
  }

  const headerLabels: Array<{ key: keyof HeaderChecks; label: string }> = [
    { key: 'csp', label: 'Content-Security-Policy' },
    { key: 'hsts', label: 'Strict-Transport-Security (HSTS)' },
    { key: 'xFrame', label: 'X-Frame-Options' },
    { key: 'xContentType', label: 'X-Content-Type-Options' },
    { key: 'referrerPolicy', label: 'Referrer-Policy' },
    { key: 'permissionsPolicy', label: 'Permissions-Policy' },
  ];

  if (headers) {
    for (const { key, label } of headerLabels) {
      if (headers[key]) {
        strengths.push({
          label: `${label} active`,
          detail: 'This browser protection is in place and working as expected.',
        });
      }
    }
  }

  for (const item of passed) {
    const normalized = item.trim();
    if (!normalized) continue;
    const alreadyCovered = strengths.some(
      (s) => s.label.toLowerCase().includes(normalized.toLowerCase().slice(0, 12)),
    );
    if (!alreadyCovered) {
      strengths.push({
        label: normalized,
        detail: 'Verified during your latest scan — no action needed right now.',
      });
    }
  }

  if (findings.length === 0) {
    strengths.push({
      label: 'Clean scan result',
      detail: 'No major misconfigurations were detected in this report.',
    });
  }

  return strengths;
}

export function buildThirtyDayPlan(findingViews: FindingExecutiveView[]): WeeklyPlanItem[] {
  const criticalHigh = findingViews.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  const medium = findingViews.filter((f) => f.severity === 'medium');
  const low = findingViews.filter((f) => f.severity === 'low');

  const week1Tasks =
    criticalHigh.length > 0
      ? criticalHigh.slice(0, 3).map((f) => `Fix: ${f.title}`)
      : ['Review scan results with your team', 'Confirm hosting and SSL contacts are up to date'];

  const week2Tasks =
    criticalHigh.length > 3
      ? criticalHigh.slice(3).map((f) => `Fix: ${f.title}`)
      : medium.length > 0
        ? medium.slice(0, 2).map((f) => `Address: ${f.title}`)
        : ['Re-run a security scan to confirm improvements'];

  const week3Tasks =
    medium.length > 2
      ? medium.slice(2).map((f) => `Address: ${f.title}`)
      : low.length > 0
        ? low.slice(0, 2).map((f) => `Improve: ${f.title}`)
        : ['Document changes made and share with stakeholders'];

  const week4Tasks = [
  ...(low.length > 2 ? low.slice(2).map((f) => `Improve: ${f.title}`) : []),
    'Run a follow-up scan to measure score improvement',
    'Schedule monthly review of third-party scripts and vendors',
  ];

  return [
    { week: 1, title: 'Week 1 — Highest-impact fixes', tasks: week1Tasks },
    { week: 2, title: 'Week 2 — Close remaining gaps', tasks: week2Tasks },
    { week: 3, title: 'Week 3 — Hardening & polish', tasks: week3Tasks },
    { week: 4, title: 'Week 4 — Verify & maintain', tasks: week4Tasks },
  ];
}

function percentileContextForScore(score: number): string {
  if (score >= 90) {
    return 'Your score ranks among the strongest sites CyberShield monitors — roughly top 15% of small business websites.';
  }
  if (score >= 70) {
    return 'Your score is above the typical small business range (55–75). A few targeted fixes could reach excellent territory.';
  }
  if (score >= 50) {
    return 'Your score sits below the typical small business range (55–75). Most gaps are configuration-related, not signs of active compromise.';
  }
  return 'Your score is well below peers. Prioritize connection security and browser protections this week.';
}

export function buildSecurityScoreExplanation(
  score: number,
  findings: SecurityFinding[],
  strengths: SecurityStrength[],
): SecurityScoreExplanation {
  const presentation = securityScorePresentation(score);
  const drivers: string[] = [];

  const bySeverity = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  if (bySeverity.critical > 0) {
    drivers.push(`${bySeverity.critical} critical issue${bySeverity.critical === 1 ? '' : 's'} weighing heavily on your score`);
  }
  if (bySeverity.high > 0) {
    drivers.push(`${bySeverity.high} high-priority gap${bySeverity.high === 1 ? '' : 's'} in protections`);
  }
  if (bySeverity.medium > 0) {
    drivers.push(`${bySeverity.medium} moderate improvement${bySeverity.medium === 1 ? '' : 's'} available`);
  }
  if (drivers.length === 0 && findings.length > 0) {
    drivers.push('Minor configuration gaps — score impact is limited');
  }
  if (findings.length === 0) {
    drivers.push('No deductions from active findings');
  }

  presentation.contributors.forEach((c) => drivers.push(c));

  const positiveFactors =
    strengths.length > 0
      ? strengths.slice(0, 4).map((s) => s.label)
      : ['Baseline protections under review'];

  return {
    score,
    band: securityScoreBand(score),
    percentileContext: percentileContextForScore(score),
    scoreDrivers: drivers.slice(0, 5),
    positiveFactors,
  };
}

export function buildExecutiveSummary(
  report: SecurityIntelligenceReport,
  fixTheseFirst: FixTheseFirstSummary,
): ExecutiveSummary {
  const score = report.securityScore;
  const findingCount = report.findings.length;
  const band = securityScoreBand(score);

  const statusBullets: string[] = [];

  if (score >= 70) {
    statusBullets.push('Your website has a solid security baseline.');
  } else if (score >= 50) {
    statusBullets.push('Your website is operational but missing key browser protections.');
  } else {
    statusBullets.push('Your website has urgent security gaps that visitors and partners may notice.');
  }

  if (findingCount === 0) {
    statusBullets.push('No major misconfigurations detected in this scan.');
  } else {
    const highCount = report.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    ).length;
    if (highCount > 0) {
      statusBullets.push(
        `${highCount} high-impact item${highCount === 1 ? '' : 's'} should be addressed soon.`,
      );
    } else {
      statusBullets.push(
        `${findingCount} improvement${findingCount === 1 ? '' : 's'} identified — mostly quick wins.`,
      );
    }
  }

  if (report.changeSummary.posture === 'improved') {
    statusBullets.push('Security posture improved since your last scan.');
  } else if (report.changeSummary.posture === 'degraded') {
    statusBullets.push('New changes since your last scan reduced your security score.');
  }

  const overallRisk =
    report.riskLevel === 'low'
      ? 'Overall risk: Low — maintain monitoring'
      : report.riskLevel === 'medium'
        ? 'Overall risk: Moderate — schedule fixes this month'
        : report.riskLevel === 'high'
          ? 'Overall risk: High — prioritize remediation this week'
          : 'Overall risk: Critical — act immediately';

  let nextStep = 'No action needed — monitoring continues automatically.';
  if (fixTheseFirst.actions.length > 0) {
    nextStep = `Start with "${fixTheseFirst.actions[0].title}" — highest impact for your score.`;
  } else if (findingCount > 0) {
    nextStep = 'Review grouped findings below and tackle easy wins first.';
  }

  const headline =
    findingCount === 0
      ? 'Strong security posture — keep monitoring'
      : score < 50
        ? 'Attention needed — protect customer trust'
        : band === 'Below average'
          ? 'Room to improve — mostly configuration fixes'
          : 'Good foundation — a few upgrades recommended';

  return {
    headline,
    statusBullets,
    overallRisk,
    nextStep,
  };
}

export function buildSecurityProgress(
  currentScore: number,
  previousScore: number | null,
  completedAt: string | null,
  startedAt: string,
  historicalScores: number[],
): SecurityProgress {
  const allScores = [...historicalScores, currentScore].filter((s) => s !== null);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;
  const scanIso = completedAt ?? startedAt;
  const lastScanLabel = formatRelativeScanTime(scanIso);

  return {
    lastScanLabel,
    bestScore,
    currentScore,
    trend: securityTrend(currentScore, previousScore),
  };
}

export interface BuildExecutiveReportInput {
  report: SecurityIntelligenceReport;
  passed?: string[];
  headers?: HeaderChecks | null;
  sslValid?: boolean | null;
  previousScore?: number | null;
  completedAt?: string | null;
  startedAt?: string;
  historicalScores?: number[];
}

export function buildExecutiveReportPresentation(
  input: BuildExecutiveReportInput,
): ExecutiveReportPresentation {
  const {
    report,
    passed = [],
    headers = null,
    sslValid = null,
    previousScore = null,
    completedAt = null,
    startedAt = new Date().toISOString(),
    historicalScores = [],
  } = input;

  const findingViews = report.findings.map((f) =>
    buildFindingExecutiveView(f, report.securityScore),
  );
  const strengths = extractSecurityStrengths(passed, headers, sslValid, report.findings);
  const fixTheseFirst = buildFixTheseFirst(findingViews, report.securityScore);
  const groupedFindings = groupFindingsByBusinessImpact(findingViews);
  const plan = buildThirtyDayPlan(findingViews);
  const scoreExplanation = buildSecurityScoreExplanation(
    report.securityScore,
    report.findings,
    strengths,
  );
  const summary = buildExecutiveSummary(report, fixTheseFirst);
  const progress = buildSecurityProgress(
    report.securityScore,
    previousScore,
    completedAt,
    startedAt,
    historicalScores,
  );

  return {
    summary,
    scoreExplanation,
    fixTheseFirst,
    strengths,
    groupedFindings,
    plan,
    progress,
    findingViews,
  };
}
