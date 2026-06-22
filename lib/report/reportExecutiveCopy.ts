import type { HeaderChecks } from '@/lib/scanner/runScan';
import {
  buildBusinessFindingCopy,
  type BusinessFindingCopy,
} from '@/lib/report/findingBusinessCopy';
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

export type { BusinessFindingCopy };

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
  business: BusinessFindingCopy;
  businessImpact: BusinessImpactInfo;
  effort: EffortEstimate;
  scoreImpact: ScoreImpactPreview;
  technicalExplanation: string;
}

export interface ExecutiveSnapshot {
  trustScore: number;
  band: string;
  status: string;
  mainTakeaway: string;
  recommendedAction: string;
  monitoringCtaLabel: string;
}

export interface ScoreChangeExplanation {
  show: boolean;
  previousScore: number;
  currentScore: number;
  delta: number;
  headline: string;
  whatChanged: string;
  interpretation: string;
  nextStep: string;
  trendLabel: string;
}

export interface MonitoringValueSection {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  priceLabel: string;
  bullets: string[];
}

export interface StrengthGroup {
  label: string;
  active: boolean;
  detail: string;
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
  sectionLabel: string;
  actions: FixFirstAction[];
  totalEstimatedGain: number;
  totalEffortLabel: string;
  potentialImprovement: string;
}

export function fixTheseFirstSectionLabel(
  score: number,
  severities: Severity[],
): string {
  const hasCriticalHigh = severities.some((s) => s === 'critical' || s === 'high');
  if (score < 70 || hasCriticalHigh) {
    return 'Fix These First';
  }
  return 'Recommended Website Trust Improvements';
}

function buildPotentialImprovementText(
  score: number,
  actionCount: number,
  projectedTotal: number,
): string {
  if (score >= 70 && score < 90) {
    return 'Addressing these items could move your site toward the excellent range — actual results depend on how the site is configured after changes.';
  }
  if (score >= 90) {
    return 'These refinements can help maintain an excellent score as your site evolves.';
  }
  if (projectedTotal >= 98) {
    return `Addressing these ${actionCount} item${actionCount === 1 ? '' : 's'} could significantly improve your score estimate.`;
  }
  return `Addressing these ${actionCount} item${actionCount === 1 ? '' : 's'} could raise your score to about ${projectedTotal}/100.`;
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
  snapshot: ExecutiveSnapshot;
  scoreChange: ScoreChangeExplanation;
  monitoringValue: MonitoringValueSection;
  strengthGroups: StrengthGroup[];
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
  'Executive Snapshot',
  'Fix These First',
  'What This Means for Your Business',
  'Below average',
  'Why ongoing monitoring matters',
  'Security Strengths',
  '30-Day Security Improvement Plan',
  'Monitoring History',
  'Technical Explanation',
  'Executive view',
  'Technical view',
  'Start Pro Monitoring',
] as const;

export const MONITORING_VALUE_SECTION: MonitoringValueSection = {
  title: 'Why ongoing monitoring matters',
  body:
    'A one-time scan is useful, but websites change. Plugins update, scripts get added, APIs change, and headers can be removed. CyberShieldCloud monitors these changes and alerts you before small configuration changes turn into trust or security problems.',
  ctaLabel: 'Start Pro Monitoring — $79/month',
  ctaHref: '/pricing',
  priceLabel: '$79/month',
  bullets: [
    'Recurring scans',
    'Score change tracking',
    'Plain-English reports',
    'Email alerts',
    'Finding history',
    'Developer-ready fix notes',
  ],
};

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
      'Public pages, endpoints, and scripts visible in your homepage scan — worth reviewing, not necessarily vulnerabilities.',
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
      label: 'Worth reviewing',
      ifIgnored:
        'Unreviewed configuration can drift over time. Periodic review keeps customer trust strong.',
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

/** Softer display gains for good-score sites — avoids implying each moderate item adds full engine delta. */
function displayGainForFinding(score: number, severity: Severity): number {
  const raw = SEVERITY_DEDUCTIONS[severity];
  if (score >= 70 && score < 90) {
    if (severity === 'medium') return Math.min(raw, Math.max(3, Math.ceil((100 - score) / 8)));
    if (severity === 'low') return Math.min(raw, 3);
  }
  return raw;
}

function applyGoodScoreSequentialImpacts(
  findingViews: FindingExecutiveView[],
  startScore: number,
): void {
  if (startScore < 70 || startScore >= 90) return;

  const ordered = [...findingViews].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  let running = startScore;
  for (const view of ordered) {
    const gain = displayGainForFinding(running, view.severity);
    const projected = Math.min(100, running + gain);
    view.scoreImpact = {
      currentScore: running,
      projectedScore: projected,
      estimatedGain: projected - running,
    };
    running = projected;
  }
}

function scoreImpactForFinding(currentScore: number, severity: Severity): ScoreImpactPreview {
  const gain = displayGainForFinding(currentScore, severity);
  const projected = Math.min(100, currentScore + gain);
  return {
    currentScore,
    projectedScore: projected,
    estimatedGain: projected - currentScore,
  };
}

function businessSummaryFromFinding(finding: SecurityFinding, business: BusinessFindingCopy): string {
  return business.whyItMatters;
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
  const business = buildBusinessFindingCopy(finding);
  return {
    findingId: finding.id,
    title: business.plainTitle,
    severity: finding.severity,
    categoryGroup: group.name,
    businessSummary: businessSummaryFromFinding(finding, business),
    business,
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
  const projectedTotal =
    actions.length > 0
      ? actions[actions.length - 1]!.projectedScore
      : Math.min(100, currentScore + totalGain);

  const effortLevels = new Set(actions.map((a) => a.effort.level));
  let totalEffortLabel = 'Low effort overall';
  if (effortLevels.has('advanced')) {
    totalEffortLabel = 'Mixed effort — plan developer time';
  } else if (effortLevels.has('moderate')) {
    totalEffortLabel = 'Moderate effort — a focused afternoon';
  }

  return {
    sectionLabel: fixTheseFirstSectionLabel(
      currentScore,
      ranked.map((r) => r.severity),
    ),
    actions,
    totalEstimatedGain: totalGain,
    totalEffortLabel,
    potentialImprovement: buildPotentialImprovementText(
      currentScore,
      actions.length,
      projectedTotal,
    ),
  };
}

function headerStrengthDetail(key: keyof HeaderChecks): string {
  switch (key) {
    case 'csp':
      return 'Helps limit which scripts and resources the browser can load on your pages.';
    case 'hsts':
      return 'Tells browsers to use HTTPS only — reduces accidental insecure connections.';
    case 'xFrame':
      return 'Reduces clickjacking risk by controlling whether your site can be framed.';
    case 'xContentType':
      return 'Helps prevent browsers from misinterpreting file types.';
    case 'referrerPolicy':
      return 'Controls how much referrer information is sent with outbound links.';
    case 'permissionsPolicy':
      return 'Restricts access to sensitive browser features when not needed.';
    default:
      return 'This browser protection is active on your site.';
  }
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
    const activeHeaders = headerLabels.filter(({ key }) => headers[key]);
    if (activeHeaders.length >= 3) {
      const shortNames = activeHeaders.map(({ label }) => label.split(' ')[0] ?? label);
      strengths.push({
        label: `${activeHeaders.length} browser security headers active`,
        detail: `Includes ${shortNames.join(', ')} — these baseline browser protections are working as expected.`,
      });
    } else {
      for (const { key, label } of activeHeaders) {
        strengths.push({
          label: `${label} active`,
          detail: headerStrengthDetail(key),
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

export function buildStrengthGroups(
  headers: HeaderChecks | null,
  sslValid: boolean | null,
): StrengthGroup[] {
  const browserKeys: Array<keyof HeaderChecks> = ['csp', 'hsts', 'xContentType', 'permissionsPolicy'];
  const privacyKeys: Array<keyof HeaderChecks> = ['referrerPolicy'];
  const clickjackKeys: Array<keyof HeaderChecks> = ['xFrame'];

  const countActive = (keys: Array<keyof HeaderChecks>) =>
    headers ? keys.filter((k) => headers[k]).length : 0;

  const browserActive = countActive(browserKeys);
  const privacyActive = countActive(privacyKeys);
  const clickjackActive = countActive(clickjackKeys);

  return [
    {
      label: 'HTTPS / SSL active',
      active: sslValid === true,
      detail: sslValid
        ? 'Visitor traffic is encrypted — a core trust signal for customers and search engines.'
        : 'HTTPS was not confirmed on this scan. Enable encryption across the entire site.',
    },
    {
      label: 'Browser security protections active',
      active: browserActive > 0,
      detail:
        browserActive >= 2
          ? `${browserActive} core browser protections are configured (e.g. CSP, HSTS).`
          : browserActive === 1
            ? 'One core browser protection is active — additional headers can further harden trust.'
            : 'No core browser security headers were detected on this scan.',
    },
    {
      label: 'Privacy / referrer protections active',
      active: privacyActive > 0,
      detail:
        privacyActive > 0
          ? 'Referrer and privacy-related headers help control what data leaves your site with outbound links.'
          : 'Referrer policy was not detected — worth reviewing with your developer.',
    },
    {
      label: 'Clickjacking protection active',
      active: clickjackActive > 0,
      detail:
        clickjackActive > 0
          ? 'Frame-control headers reduce the risk of your site being embedded on untrusted pages.'
          : 'Clickjacking protection was not detected — consider adding frame-control headers.',
    },
  ];
}

/** Report-facing trend label — avoids "declining" unless multiple scans show consistent drops. */
export function reportProgressTrendLabel(
  trend: SecurityTrend,
  historicalScores: number[],
  currentScore: number,
): string {
  if (trend.direction === 'improving') return trend.deltaLabel;
  if (trend.direction === 'stable') return trend.deltaLabel;
  if (trend.direction === 'unknown') return trend.deltaLabel;

  const allScores = [...historicalScores, currentScore];
  const consistentDecline =
    allScores.length >= 3 &&
    allScores.every((s, i) => i === 0 || s <= allScores[i - 1]!);

  if (consistentDecline && trend.previousScore !== null) {
    return `Declining · ${trend.deltaLabel}`;
  }
  return `Score changed · ${trend.deltaLabel}`;
}

export function buildExecutiveSnapshot(
  report: SecurityIntelligenceReport,
  fixTheseFirst: FixTheseFirstSummary,
  scoreExplanation: SecurityScoreExplanation,
): ExecutiveSnapshot {
  const score = report.securityScore;
  const findingCount = report.findings.length;
  const highCount = report.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length;

  let status = 'Monitoring recommended';
  if (score >= 90 && findingCount === 0) {
    status = 'Strong trust baseline';
  } else if (score >= 70 && highCount === 0) {
    status = 'Solid baseline — items to review';
  } else if (score >= 50) {
    status = 'Trust improvements available';
  } else {
    status = 'Priority items need attention';
  }

  let mainTakeaway: string;
  if (findingCount === 0) {
    mainTakeaway =
      'This scan did not detect major public-facing configuration gaps. Ongoing monitoring helps you keep that baseline as your site changes.';
  } else if (score >= 70 && highCount === 0) {
    mainTakeaway = `Your website has a solid baseline, but this scan found ${findingCount} public-facing item${findingCount === 1 ? '' : 's'} worth reviewing. These are not confirmed vulnerabilities, but they are the kind of changes CyberShieldCloud is designed to monitor over time.`;
  } else if (highCount > 0) {
    mainTakeaway = `This scan found ${highCount} higher-priority item${highCount === 1 ? '' : 's'} that can affect customer trust or account safety. Address these with your developer or host — this is preventive hardening, not proof of an active breach unless confirmed separately.`;
  } else {
    mainTakeaway = `This scan found ${findingCount} configuration item${findingCount === 1 ? '' : 's'} worth reviewing. None of these alone confirms an active compromise — they are exposure and hardening signals CyberShieldCloud tracks over time.`;
  }

  let recommendedAction =
    fixTheseFirst.actions.length > 0
      ? fixTheseFirst.actions[0]!.title
      : 'No urgent changes — keep monthly monitoring enabled.';

  if (score >= 70 && highCount === 0 && fixTheseFirst.actions.length > 0) {
    recommendedAction =
      'Review the recommended trust improvements below with your developer or host when convenient.';
  }

  return {
    trustScore: score,
    band: scoreExplanation.band,
    status,
    mainTakeaway,
    recommendedAction,
    monitoringCtaLabel: MONITORING_VALUE_SECTION.ctaLabel,
  };
}

export function buildScoreChangeExplanation(
  report: SecurityIntelligenceReport,
  previousScore: number | null,
  historicalScores: number[],
): ScoreChangeExplanation {
  const currentScore = report.securityScore;
  const trend = securityTrend(currentScore, previousScore);
  const trendLabel = reportProgressTrendLabel(trend, historicalScores, currentScore);

  if (previousScore === null || currentScore >= previousScore) {
    return {
      show: false,
      previousScore: previousScore ?? currentScore,
      currentScore,
      delta: 0,
      headline: 'Why your score changed',
      whatChanged: '',
      interpretation: '',
      nextStep: '',
      trendLabel,
    };
  }

  const delta = currentScore - previousScore;
  const newFindingCount = report.findings.length;
  const highlights = report.changeSummary.highlights.slice(0, 2);

  let whatChanged: string;
  if (highlights.length > 0) {
    whatChanged = highlights.join(' ');
  } else if (newFindingCount > 0) {
    whatChanged = `New items were detected since your last scan (${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} estimated impact).`;
  } else {
    whatChanged = `Your score is ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} lower than the previous scan based on updated checks.`;
  }

  const hasCriticalHigh = report.findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  const interpretation = hasCriticalHigh
    ? 'This reflects additional detected exposure and priority gaps — not necessarily a confirmed active attack. Treat urgent items as hardening work with your developer.'
    : 'This reflects new detected exposure or configuration differences — not a confirmed compromise. Many score changes come from new scripts, headers, or routes appearing between scans.';

  const nextStep =
    fixTheseFirstSectionLabel(
      currentScore,
      report.findings.map((f) => f.severity),
    ) === 'Fix These First'
      ? 'Start with the priority items below and re-scan after changes.'
      : 'Review the new items below when convenient — monitoring will alert you if they change again.';

  return {
    show: true,
    previousScore,
    currentScore,
    delta,
    headline: 'Why your score changed',
    whatChanged,
    interpretation,
    nextStep,
    trendLabel,
  };
}

export function buildThirtyDayPlan(
  findingViews: FindingExecutiveView[],
  securityScore?: number,
): WeeklyPlanItem[] {
  const criticalHigh = findingViews.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  const medium = findingViews.filter((f) => f.severity === 'medium');
  const low = findingViews.filter((f) => f.severity === 'low');

  const isHardeningPlan =
    criticalHigh.length === 0 &&
    findingViews.length > 0 &&
    (securityScore ?? 0) >= 70;

  if (isHardeningPlan) {
    return buildGoodScoreHardeningPlan(findingViews);
  }

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

function buildGoodScoreHardeningPlan(findingViews: FindingExecutiveView[]): WeeklyPlanItem[] {
  const tasksForIds = (ids: string[], fallback: string): string[] => {
    const matches = findingViews.filter((v) => ids.includes(v.findingId));
    if (matches.length === 0) return [fallback];
    return matches.map((m) => `Review: ${m.title}`);
  };

  return [
    {
      week: 1,
      title: 'Week 1 — Third-party review',
      tasks: tasksForIds(
        ['external_scripts', 'third_party_dependencies', 'analytics_tracking'],
        'Review third-party scripts and confirm required vendors.',
      ),
    },
    {
      week: 2,
      title: 'Week 2 — Authentication review',
      tasks: tasksForIds(
        ['auth_endpoints', 'login_surface'],
        'Review login and authentication protections (rate limiting, secure cookies).',
      ),
    },
    {
      week: 3,
      title: 'Week 3 — API & surface review',
      tasks: tasksForIds(
        ['external_api_calls', 'admin_endpoints'],
        'Review external API calls and client-side configuration.',
      ),
    },
    {
      week: 4,
      title: 'Week 4 — Verify & document',
      tasks: [
        'Run a follow-up scan and save the report for your records',
        'Share hardening notes with your developer or host if needed',
      ],
    },
  ];
}

function percentileContextForScore(score: number): string {
  if (score >= 90) {
    return 'Your score is excellent — an estimated strong result based on this scan, not a live peer benchmark.';
  }
  if (score >= 70) {
    return 'Your site has a solid security baseline. A few targeted hardening steps could move it closer to excellent.';
  }
  if (score >= 50) {
    return 'Your score has room to improve. Most gaps are configuration-related, not signs of active compromise.';
  }
  return 'Your score needs attention. Prioritize connection security and browser protections this week.';
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
  const highCount = report.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length;

  const statusBullets: string[] = [];

  if (report.changeSummary.posture === 'improved') {
    statusBullets.push('Trust score improved since your last scan.');
  } else if (report.changeSummary.posture === 'degraded') {
    statusBullets.push('New items detected since your last scan — see score change details below.');
  }

  if (findingCount === 0) {
    statusBullets.push('No major misconfigurations detected in this scan.');
  } else if (highCount > 0) {
    statusBullets.push(
      `${highCount} priority item${highCount === 1 ? '' : 's'} flagged for review with your developer or host.`,
    );
  }

  const overallRisk =
    report.riskLevel === 'low'
      ? 'Overall risk: Low — maintain monitoring'
      : report.riskLevel === 'medium'
        ? score >= 70
          ? 'Overall risk: Moderate — trust improvements available'
          : 'Overall risk: Moderate — schedule fixes this month'
        : report.riskLevel === 'high'
          ? 'Overall risk: High — prioritize remediation this week'
          : 'Overall risk: Critical — act immediately';

  const nextStep =
    fixTheseFirst.actions.length > 0
      ? score >= 70 && highCount === 0
        ? 'Review recommended trust improvements below — preventive, not confirmed vulnerabilities.'
        : `Start with "${fixTheseFirst.actions[0]!.title}".`
      : findingCount > 0
        ? 'Review findings below and tackle easy wins first.'
        : 'No action needed — monitoring continues automatically.';

  const headline =
    findingCount === 0
      ? 'Strong security posture — keep monitoring'
      : score < 50
        ? 'Attention needed — protect customer trust'
        : band === 'Below average'
          ? 'Room to improve — mostly configuration fixes'
          : score >= 70
            ? 'Solid baseline — trust improvements identified'
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
  applyGoodScoreSequentialImpacts(findingViews, report.securityScore);

  const strengths = extractSecurityStrengths(passed, headers, sslValid, report.findings);
  const strengthGroups = buildStrengthGroups(headers, sslValid);
  const fixTheseFirst = buildFixTheseFirst(findingViews, report.securityScore);
  const groupedFindings = groupFindingsByBusinessImpact(findingViews);
  const plan = buildThirtyDayPlan(findingViews, report.securityScore);
  const scoreExplanation = buildSecurityScoreExplanation(
    report.securityScore,
    report.findings,
    strengths,
  );
  const summary = buildExecutiveSummary(report, fixTheseFirst);
  const snapshot = buildExecutiveSnapshot(report, fixTheseFirst, scoreExplanation);
  const scoreChange = buildScoreChangeExplanation(
    report,
    previousScore,
    historicalScores,
  );
  const progress = buildSecurityProgress(
    report.securityScore,
    previousScore,
    completedAt,
    startedAt,
    historicalScores,
  );

  return {
    snapshot,
    scoreChange,
    monitoringValue: MONITORING_VALUE_SECTION,
    strengthGroups,
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
