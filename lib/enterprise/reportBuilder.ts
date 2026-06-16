import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganization } from '@/lib/org/context';
import { getCanonicalOrgSecurityState } from './canonicalOrgSecurityState';
import { POSTURE_DISPLAY, type PostureState } from './postureState';
import {
  classifyIssueSeverity,
  diffScanFindings,
  normalizeIssues,
  type ScanFindingDiff,
  type ScanFindingRow,
} from './scanDiff';
import type { RiskDistribution } from './enterpriseTypes';
import type { OrgSecurityNarrative, SecurityNarrative } from './narrativeTypes';

export interface ReportDateRange {
  start: string;
  end: string;
}

export interface EnterpriseReportCover {
  orgName: string;
  primaryDomain: string;
  dateRange: ReportDateRange;
  generatedAt: string;
  postureState: PostureState | null;
  postureLabel: string;
}

export interface EnterpriseReportExecutive {
  orgNarrative: OrgSecurityNarrative;
  rollingRiskScore: number | null;
  totalScansAnalyzed: number;
  sitesMonitored: number;
}

export interface RiskScorePoint {
  date: string;
  score: number;
}

export interface EnterpriseReportMetrics {
  rollingRiskScore: number | null;
  riskDistribution: RiskDistribution;
  riskScoreTimeline: RiskScorePoint[];
  totalVulnerabilities: number;
  resolvedFindings: number;
  activeFindings: number;
}

export type SecurityEventType =
  | 'new_vulnerability'
  | 'risk_escalation'
  | 'configuration_drift'
  | 'security_improvement'
  | 'anomaly';

export interface SecurityTimelineEvent {
  date: string;
  eventType: SecurityEventType;
  severity: string;
  description: string;
  source: 'scan_diff' | 'anomaly';
}

export interface ReportFinding {
  severity: string;
  description: string;
  category: string;
}

export interface EnterpriseReportScanDetail {
  scanId: string;
  url: string;
  label: string | null;
  completedAt: string | null;
  securityScore: number | null;
  findings: ReportFinding[];
  diff: ScanFindingDiff;
}

export interface EnterpriseReportAnomaly {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

export interface ActionPlanItem {
  priority: 'critical' | 'high' | 'hardening';
  action: string;
}

export interface EnterpriseReportCompliance {
  changeManagementSignals: string[];
  monitoringCoverage: string[];
  accessPostureIndicators: string[];
  auditReadinessStatement: string;
}

export interface EnterpriseReportData {
  cover: EnterpriseReportCover;
  executive: EnterpriseReportExecutive;
  metrics: EnterpriseReportMetrics;
  timeline: SecurityTimelineEvent[];
  scanDetails: EnterpriseReportScanDetail[];
  anomalies: EnterpriseReportAnomaly[];
  actionPlan: ActionPlanItem[];
  compliance: EnterpriseReportCompliance;
  latestScanNarrative: SecurityNarrative | null;
}

type ScanRow = ScanFindingRow & {
  id: string;
  org_id: string;
  website_id: string;
  status: string;
  vulnerabilities_count: number | null;
  websites?: { url: string; label: string | null } | { url: string; label: string | null }[] | null;
};

const DEFAULT_RANGE_DAYS = 30;

export function sanitizeReportText(text: string, maxLen = 2000): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLen);
}

export function defaultDateRange(): ReportDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DEFAULT_RANGE_DAYS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function parseDateRange(input?: Partial<ReportDateRange> | null): ReportDateRange {
  if (input?.start && input?.end) {
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { start: start.toISOString(), end: end.toISOString() };
    }
  }
  return defaultDateRange();
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
}

export function classifyIssueCategory(issue: string): string {
  if (/ssl|https|tls|certificate/i.test(issue)) return 'SSL/TLS';
  if (/xss|cross-site scripting/i.test(issue)) return 'XSS';
  if (/content-security-policy|csp|hsts|x-frame|x-content|referrer|permissions-policy|header/i.test(issue)) {
    return 'Headers';
  }
  if (/login|auth|credential/i.test(issue)) return 'Authentication';
  return 'Configuration';
}

function issuesToFindings(issues: unknown): ReportFinding[] {
  return normalizeIssues(issues).map((issue) => ({
    severity: classifyIssueSeverity(issue),
    description: sanitizeReportText(issue, 500),
    category: classifyIssueCategory(issue),
  }));
}

function diffToTimelineEvents(
  diff: ScanFindingDiff,
  completedAt: string | null,
  url: string,
): SecurityTimelineEvent[] {
  const date = completedAt ?? new Date().toISOString();
  const events: SecurityTimelineEvent[] = [];

  for (const issue of diff.escalated) {
    events.push({
      date,
      eventType: 'risk_escalation',
      severity: classifyIssueSeverity(issue),
      description: sanitizeReportText(`Risk escalation on ${url}: ${issue}`),
      source: 'scan_diff',
    });
  }

  for (const issue of diff.added.filter((i) => !diff.escalated.includes(i))) {
    events.push({
      date,
      eventType: 'new_vulnerability',
      severity: classifyIssueSeverity(issue),
      description: sanitizeReportText(`New finding on ${url}: ${issue}`),
      source: 'scan_diff',
    });
  }

  if (diff.added.length > 0 || diff.removed.length > 0) {
    events.push({
      date,
      eventType: 'configuration_drift',
      severity: 'medium',
      description: sanitizeReportText(
        `Configuration drift on ${url}: ${diff.added.length} added, ${diff.removed.length} removed`,
      ),
      source: 'scan_diff',
    });
  }

  for (const issue of diff.removed) {
    events.push({
      date,
      eventType: 'security_improvement',
      severity: 'low',
      description: sanitizeReportText(`Resolved on ${url}: ${issue}`),
      source: 'scan_diff',
    });
  }

  return events;
}

function buildRiskTimeline(scans: ScanRow[]): RiskScorePoint[] {
  const byDay = new Map<string, number[]>();

  for (const scan of scans) {
    if (scan.security_score === null || !scan.completed_at) continue;
    const day = scan.completed_at.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(scan.security_score);
    byDay.set(day, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
    }));
}

function buildActionPlan(
  scanDetails: EnterpriseReportScanDetail[],
  anomalies: EnterpriseReportAnomaly[],
  narrative: SecurityNarrative | null,
): ActionPlanItem[] {
  const actions = new Map<string, ActionPlanItem['priority']>();

  const addAction = (action: string, priority: ActionPlanItem['priority']) => {
    const key = action.toLowerCase();
    const existing = actions.get(key);
    if (!existing || (priority === 'critical' && existing !== 'critical')) {
      actions.set(key, priority);
    }
  };

  for (const scan of scanDetails) {
    for (const finding of scan.findings) {
      const desc = finding.description.toLowerCase();
      if (finding.severity === 'critical') {
        if (/ssl|https/i.test(desc)) addAction('Enable HTTPS and valid TLS certificates', 'critical');
        else addAction(`Remediate critical finding: ${finding.description.slice(0, 80)}`, 'critical');
      } else if (finding.severity === 'high') {
        if (/content-security-policy|csp/i.test(desc)) addAction('Add Content-Security-Policy header', 'high');
        if (/strict-transport-security|hsts/i.test(desc)) addAction('Enable Strict-Transport-Security (HSTS)', 'high');
        if (/x-frame-options/i.test(desc)) addAction('Fix missing X-Frame-Options header', 'high');
        if (/x-content-type-options/i.test(desc)) addAction('Add X-Content-Type-Options header', 'high');
      }
    }

    if (scan.diff.escalated.length > 0) {
      addAction('Investigate security regression on affected properties', 'critical');
    }
  }

  for (const anomaly of anomalies.filter((a) => !a.resolved)) {
    if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
      addAction(`Investigate anomaly: ${anomaly.message.slice(0, 100)}`, 'critical');
    }
  }

  if (narrative) {
    for (const action of narrative.recommended_actions) {
      addAction(action, 'hardening');
    }
  }

  addAction('Enable continuous monitoring to detect configuration drift', 'hardening');
  addAction('Schedule periodic security header review', 'hardening');

  const priorityOrder: ActionPlanItem['priority'][] = ['critical', 'high', 'hardening'];
  return [...actions.entries()]
    .map(([action, priority]) => ({ action: sanitizeReportText(action, 300), priority }))
    .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
}

function buildComplianceSummary(
  totalScans: number,
  sitesMonitored: number,
  timeline: SecurityTimelineEvent[],
  postureState: PostureState | null,
  anomalies: EnterpriseReportAnomaly[],
): EnterpriseReportCompliance {
  const driftEvents = timeline.filter((e) => e.eventType === 'configuration_drift').length;
  const improvements = timeline.filter((e) => e.eventType === 'security_improvement').length;
  const openAnomalies = anomalies.filter((a) => !a.resolved).length;

  return {
    changeManagementSignals: [
      `${driftEvents} configuration change signal${driftEvents === 1 ? '' : 's'} detected in reporting period`,
      `${improvements} resolved finding${improvements === 1 ? '' : 's'} indicate active remediation`,
      'Scan diffs provide auditable before/after visibility for security changes',
    ],
    monitoringCoverage: [
      `${sitesMonitored} site${sitesMonitored === 1 ? '' : 's'} under continuous monitoring`,
      `${totalScans} completed scan${totalScans === 1 ? '' : 's'} analyzed in selected date range`,
      'Rolling risk scoring applied across recent scan window',
    ],
    accessPostureIndicators: [
      postureState
        ? `Organization posture state: ${POSTURE_DISPLAY[postureState].label}`
        : 'Posture baseline pending sufficient scan history',
      openAnomalies > 0
        ? `${openAnomalies} open intelligence anomal${openAnomalies === 1 ? 'y' : 'ies'} under review`
        : 'No open intelligence anomalies in reporting period',
    ],
    auditReadinessStatement:
      'This report provides SOC2-style control visibility for change management, monitoring coverage, and security posture indicators. It does not constitute SOC2 certification or attestation.',
  };
}

export async function buildEnterpriseReport(
  orgId: string,
  dateRangeInput?: Partial<ReportDateRange> | null,
): Promise<EnterpriseReportData> {
  const dateRange = parseDateRange(dateRangeInput);
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const [org, canonical, websitesRes, scansRes, anomaliesRes] = await Promise.all([
    getOrganization(orgId),
    getCanonicalOrgSecurityState(orgId),
    admin.from('websites').select('id, url, label, is_active').eq('org_id', orgId),
    admin
      .from('scans')
      .select(
        'id, org_id, website_id, security_score, status, completed_at, issues, vulnerabilities_count, websites(url, label)',
      )
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', dateRange.start)
      .lte('completed_at', dateRange.end)
      .order('completed_at', { ascending: false }),
    admin
      .from('org_anomalies')
      .select('id, type, severity, message, created_at, resolved')
      .eq('org_id', orgId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: false }),
  ]);

  if (scansRes.error) throw new Error(scansRes.error.message);
  if (anomaliesRes.error) throw new Error(anomaliesRes.error.message);

  const websites = websitesRes.data ?? [];
  const activeWebsites = websites.filter((w) => w.is_active !== false);
  const primaryDomain = activeWebsites[0]?.url
    ? extractDomain(activeWebsites[0].url)
    : org?.name ?? 'unknown';

  const scans = (scansRes.data ?? []) as ScanRow[];
  const rollingRiskScore = canonical.rollingRiskScore;
  const postureState = canonical.postureState;
  const riskDistribution = canonical.dashboard.riskDistribution;
  const orgNarrative = canonical.security_narratives.org;
  const latestScanNarrative = canonical.security_narratives.latestScan;

  const diffByScanId = new Map(
    canonical.scan_diff.map((entry) => [entry.scan_id, entry.diff]),
  );

  const priorScansRes = await admin
    .from('scans')
    .select('id, website_id, security_score, completed_at, issues')
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .lt('completed_at', dateRange.start)
    .order('completed_at', { ascending: false });

  const priorByWebsite = new Map<string, ScanFindingRow>();
  for (const row of (priorScansRes.data ?? []) as ScanFindingRow[]) {
    if (!priorByWebsite.has(row.website_id)) {
      priorByWebsite.set(row.website_id, row);
    }
  }

  const scansByWebsite = new Map<string, ScanRow[]>();
  for (const scan of [...scans].sort(
    (a, b) => new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime(),
  )) {
    const list = scansByWebsite.get(scan.website_id) ?? [];
    list.push(scan);
    scansByWebsite.set(scan.website_id, list);
  }

  const scanDetails: EnterpriseReportScanDetail[] = [];
  const timeline: SecurityTimelineEvent[] = [];

  for (const scan of scans) {
    const website = Array.isArray(scan.websites) ? scan.websites[0] : scan.websites;
    const url = website?.url ?? 'unknown';
    const label = website?.label ?? null;

    const canonicalDiff = diffByScanId.get(scan.id);
    let diff: ScanFindingDiff;
    if (canonicalDiff) {
      diff = canonicalDiff;
    } else {
      const websiteScans = scansByWebsite.get(scan.website_id) ?? [];
      const scanIndex = websiteScans.findIndex((s) => s.id === scan.id);
      const previousInRange = scanIndex > 0 ? websiteScans[scanIndex - 1] : null;
      const previous = previousInRange ?? priorByWebsite.get(scan.website_id) ?? null;
      diff = diffScanFindings(previous, scan);
    }

    const canonicalResult = canonical.scan_results.find((r) => r.scan_id === scan.id);
    const findings = canonicalResult
      ? canonicalResult.issues.map((issue) => ({
          severity: classifyIssueSeverity(issue),
          description: sanitizeReportText(issue, 500),
          category: classifyIssueCategory(issue),
        }))
      : issuesToFindings(scan.issues);

    scanDetails.push({
      scanId: scan.id,
      url,
      label,
      completedAt: scan.completed_at,
      securityScore: scan.security_score,
      findings,
      diff,
    });

    timeline.push(...diffToTimelineEvents(diff, scan.completed_at, url));
  }

  const anomalies: EnterpriseReportAnomaly[] = (anomaliesRes.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    message: sanitizeReportText(row.message),
    createdAt: row.created_at,
    resolved: row.resolved,
  }));

  for (const anomaly of anomalies) {
    timeline.push({
      date: anomaly.createdAt,
      eventType: 'anomaly',
      severity: anomaly.severity,
      description: sanitizeReportText(`${anomaly.type.replace(/_/g, ' ')}: ${anomaly.message}`),
      source: 'anomaly',
    });
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let totalVulnerabilities = 0;
  let resolvedFindings = 0;
  let activeFindings = 0;

  for (const detail of scanDetails) {
    totalVulnerabilities += detail.findings.length;
    resolvedFindings += detail.diff.removed.length;
    activeFindings += detail.findings.length;
  }

  const actionPlan = buildActionPlan(scanDetails, anomalies, latestScanNarrative);
  const compliance = buildComplianceSummary(
    scans.length,
    activeWebsites.length,
    timeline,
    postureState,
    anomalies,
  );

  return {
    cover: {
      orgName: sanitizeReportText(org?.name ?? 'Organization'),
      primaryDomain: sanitizeReportText(primaryDomain, 253),
      dateRange,
      generatedAt,
      postureState,
      postureLabel: postureState ? POSTURE_DISPLAY[postureState].label : 'Unknown',
    },
    executive: {
      orgNarrative,
      rollingRiskScore,
      totalScansAnalyzed: scans.length,
      sitesMonitored: canonical.dashboard.totalSitesMonitored,
    },
    metrics: {
      rollingRiskScore,
      riskDistribution,
      riskScoreTimeline: buildRiskTimeline(scans),
      totalVulnerabilities,
      resolvedFindings,
      activeFindings,
    },
    timeline,
    scanDetails,
    anomalies,
    actionPlan,
    compliance,
    latestScanNarrative,
  };
}
