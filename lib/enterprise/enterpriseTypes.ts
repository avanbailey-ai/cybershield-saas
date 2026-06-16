import type { PostureState } from './postureState';
import type { OrgSecurityNarrative, SecurityNarrative } from './narrativeTypes';
import type { ScanFindingDiff } from './scanDiff';

export type RiskBucket = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type OrgAnomalyFeedItem = {
  id: string;
  type: string;
  severity: string;
  message: string;
  websiteId: string | null;
  createdAt: string;
  resolved: boolean;
};

export type RiskDistribution = Record<RiskBucket, number>;

export interface ClientGroupSummary {
  clientGroup: string;
  siteCount: number;
  riskDistribution: RiskDistribution;
  criticalAlertsCount: number;
}

/** Unified risk bucket thresholds — backend + frontend SSOT */
export const RISK_BUCKET_DISPLAY = [
  { key: 'critical' as const, label: 'Critical (<50)', color: 'bg-red-500', text: 'text-red-400' },
  { key: 'high' as const, label: 'High (50–69)', color: 'bg-orange-500', text: 'text-orange-400' },
  { key: 'medium' as const, label: 'Medium (70–89)', color: 'bg-yellow-500', text: 'text-yellow-400' },
  { key: 'low' as const, label: 'Low (90+)', color: 'bg-green-500', text: 'text-green-400' },
  { key: 'unknown' as const, label: 'Not scanned', color: 'bg-gray-500', text: 'text-gray-400' },
];

export function emptyRiskDistribution(): RiskDistribution {
  return { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
}

export function scoreToRiskBucket(score: number | null | undefined): RiskBucket {
  if (score === null || score === undefined) return 'unknown';
  if (score < 50) return 'critical';
  if (score < 70) return 'high';
  if (score < 90) return 'medium';
  return 'low';
}

export type CanonicalLatestScan = {
  scan_id: string;
  website_id: string;
  security_score: number | null;
  completed_at: string | null;
  vulnerabilities_count: number | null;
  website_url: string | null;
  website_label: string | null;
};

export type CanonicalScanResult = {
  scan_id: string;
  website_id: string;
  security_score: number | null;
  completed_at: string | null;
  issues: string[];
  vulnerabilities_count: number | null;
  has_open_findings: boolean;
};

export type CanonicalScanDiffEntry = {
  scan_id: string;
  website_id: string;
  completed_at: string | null;
  diff: ScanFindingDiff;
};

export type CanonicalSecurityNarratives = {
  org: OrgSecurityNarrative;
  latestScan: SecurityNarrative | null;
  latestScanAt: string | null;
};

export type CanonicalDashboardAggregates = {
  totalSitesMonitored: number;
  riskDistribution: RiskDistribution;
  criticalAlertsCount: number;
  openAlertsCount: number;
  avgScore: number | null;
  sitesByClientGroup: ClientGroupSummary[];
};

/** Single source of truth for org-wide security posture — all consumers read this. */
export interface CanonicalOrgSecurityState {
  org_id: string;
  rollingRiskScore: number | null;
  postureState: PostureState | null;
  latest_scans: CanonicalLatestScan[];
  scan_results: CanonicalScanResult[];
  scan_diff: CanonicalScanDiffEntry[];
  org_anomalies: OrgAnomalyFeedItem[];
  security_narratives: CanonicalSecurityNarratives;
  dashboard: CanonicalDashboardAggregates;
  computed_at: string;
}
