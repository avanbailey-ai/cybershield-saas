/**
 * Verify Security Report V2 executive professionalization.
 * Run: npx tsx scripts/verify-report-professionalization.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SecurityFinding } from '../lib/securityIntelligence/types';
import {
  BANNED_REPORT_PHRASES,
  REQUIRED_REPORT_PHRASES,
  buildExecutiveReportPresentation,
  buildFixTheseFirst,
  buildFindingExecutiveView,
  buildThirtyDayPlan,
  extractSecurityStrengths,
  groupFindingsByBusinessImpact,
} from '../lib/report/reportExecutiveCopy';
import type { SecurityIntelligenceReport } from '../lib/securityIntelligence/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const experiencePath = join(process.cwd(), 'components', 'report', 'SecurityReportExperience.tsx');
const copyPath = join(process.cwd(), 'lib', 'report', 'reportExecutiveCopy.ts');
const experienceSource = readFileSync(experiencePath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');

const userFacingSource = experienceSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
  .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

for (const phrase of BANNED_REPORT_PHRASES) {
  const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  assert(
    !pattern.test(userFacingSource),
    `Banned phrase "${phrase}" found in SecurityReportExperience user-facing copy`,
  );
}

const copyAndExperience = `${copySource}\n${experienceSource}`;
for (const phrase of REQUIRED_REPORT_PHRASES) {
  assert(
    copyAndExperience.includes(phrase),
    `Required phrase "${phrase}" missing from reportExecutiveCopy or SecurityReportExperience`,
  );
}

const mockFinding: SecurityFinding = {
  id: 'csp_missing',
  title: 'Content-Security-Policy header missing',
  severity: 'high',
  category: 'headers',
  description: 'No CSP header detected.',
  impact: ['XSS payloads may execute unrestricted'],
  exploitScenario: 'Attacker injects script via XSS.',
  fix: "default-src 'self'",
  securityImpactIfFixed: 'Reduces XSS blast radius.',
};

const mockReport: SecurityIntelligenceReport = {
  summary: 'machine summary should not appear in UI',
  riskLevel: 'medium',
  securityScore: 55,
  attackSurfaceScore: 40,
  attackSurfaceLevel: 'Medium',
  findings: [mockFinding],
  recommendations: [],
  changeSummary: { posture: 'no_change', scoreDelta: null, highlights: [] },
};

const presentation = buildExecutiveReportPresentation({
  report: mockReport,
  passed: ['HTTPS valid'],
  headers: { csp: false, hsts: true, xFrame: false, xContentType: true, referrerPolicy: false, permissionsPolicy: false },
  sslValid: true,
  previousScore: 50,
  completedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  historicalScores: [48, 50],
});

assert(presentation.snapshot.trustScore === 55, 'snapshot trust score');
assert(presentation.snapshot.mainTakeaway.length > 0, 'snapshot takeaway');
assert(presentation.monitoringValue.ctaLabel.includes('$79'), 'monitoring cta price');
assert(presentation.strengthGroups.length === 4, 'strength groups');
assert(presentation.scoreExplanation.band === 'Below average', 'below average band');
assert(presentation.fixTheseFirst.actions.length > 0, 'fix these first actions');
assert(presentation.strengths.length > 0, 'strengths');
assert(presentation.groupedFindings.length > 0, 'grouped findings');
assert(presentation.plan.length === 4, '30-day plan weeks');
assert(presentation.progress.bestScore !== null, 'best score');
assert(presentation.progress.trend.currentScore === 55, 'progress current');

const view = buildFindingExecutiveView(mockFinding, 55);
assert(view.business.plainTitle.length > 0, 'business plain title');
assert(view.business.developerAction.length > 0, 'developer action');
assert(view.businessImpact.label.includes('Business Impact'), 'business impact label');
assert(view.businessImpact.ifIgnored.length > 0, 'if ignored copy');
assert(view.effort.label.length > 0, 'effort label');
assert(view.scoreImpact.estimatedGain > 0, 'score impact gain');

const groups = groupFindingsByBusinessImpact([view]);
assert(groups[0].name === 'Browser Security Protections', 'category group name');

const fixFirst = buildFixTheseFirst([view], 55);
assert(fixFirst.potentialImprovement.includes('/100'), 'potential improvement for lower scores');

const goodScoreFinding: SecurityFinding = {
  id: 'external_scripts',
  title: 'External Third-Party Scripts',
  severity: 'medium',
  category: 'third_party',
  description: 'External scripts detected.',
  impact: ['External scripts are common, but each one adds a vendor dependency'],
  exploitScenario: 'Review vendors periodically.',
  fix: 'Remove unused scripts.',
  securityImpactIfFixed: 'Smaller dependency footprint.',
};

const goodReport: SecurityIntelligenceReport = {
  ...mockReport,
  securityScore: 76,
  riskLevel: 'medium',
  findings: [goodScoreFinding],
};

const goodPresentation = buildExecutiveReportPresentation({ report: goodReport, sslValid: true });
assert(
  goodPresentation.fixTheseFirst.sectionLabel === 'Recommended Website Trust Improvements',
  'good score uses trust improvements label',
);
assert(
  goodPresentation.fixTheseFirst.potentialImprovement.includes('excellent range'),
  'good score softens improvement promise',
);
assert(
  goodPresentation.scoreExplanation.percentileContext.includes('solid security baseline'),
  'good score baseline copy',
);
assert(
  goodPresentation.plan[0].title.includes('Third-party'),
  'good score hardening plan week 1',
);

const criticalReport: SecurityIntelligenceReport = {
  ...mockReport,
  securityScore: 35,
  riskLevel: 'critical',
  findings: [{ ...mockFinding, severity: 'critical' }],
};
const criticalPresentation = buildExecutiveReportPresentation({ report: criticalReport, sslValid: false });
assert(
  criticalPresentation.fixTheseFirst.sectionLabel === 'Fix These First',
  'critical score keeps urgent label',
);

const strengths = extractSecurityStrengths([], null, true, []);
assert(strengths.some((s) => s.label.includes('HTTPS')), 'https strength');

const plan = buildThirtyDayPlan([view]);
assert(plan[0].tasks.length > 0, 'week 1 tasks');

assert(
  typeof buildExecutiveReportPresentation === 'function',
  'buildExecutiveReportPresentation export',
);
assert(typeof buildFindingExecutiveView === 'function', 'buildFindingExecutiveView export');
assert(typeof buildFixTheseFirst === 'function', 'buildFixTheseFirst export');
assert(typeof extractSecurityStrengths === 'function', 'extractSecurityStrengths export');
assert(typeof buildThirtyDayPlan === 'function', 'buildThirtyDayPlan export');
assert(typeof groupFindingsByBusinessImpact === 'function', 'groupFindingsByBusinessImpact export');

console.log('verify-report-professionalization: all checks passed');
