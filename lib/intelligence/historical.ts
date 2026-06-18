/**
 * Historical intelligence types — foundation for score trends, benchmarking,
 * and cross-session website memory. No DB schema; populated from existing APIs.
 */

export interface ScoreHistoryPoint {
  recordedAt: string;
  score: number;
  scanId?: string;
}

export interface ScoreHistory {
  websiteId: string;
  points: ScoreHistoryPoint[];
  currentScore: number | null;
  previousScore: number | null;
  trendDelta: number | null;
}

export interface SslHistoryPoint {
  recordedAt: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  daysUntilExpiry: number | null;
}

export interface SslHistory {
  websiteId: string;
  points: SslHistoryPoint[];
  currentStatus: SslHistoryPoint['status'];
}

export interface ChangeHistoryPoint {
  recordedAt: string;
  changeType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  categoryLabel?: string;
}

export interface ChangeHistory {
  websiteId: string;
  points: ChangeHistoryPoint[];
  totalChanges: number;
}

export interface UptimeHistoryPoint {
  recordedAt: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  httpStatus: number | null;
  responseTimeMs: number | null;
}

export interface UptimeHistory {
  websiteId: string;
  points: UptimeHistoryPoint[];
  downtimeEvents: number;
}

export interface FindingHistoryPoint {
  recordedAt: string;
  findingId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'resolved' | 'ongoing';
}

export interface FindingHistory {
  websiteId: string;
  points: FindingHistoryPoint[];
  activeCount: number;
  resolvedCount: number;
}

export interface TechFingerprintHistoryPoint {
  recordedAt: string;
  fingerprint: Record<string, string | number | boolean | null>;
  changedKeys: string[];
}

export interface TechFingerprintHistory {
  websiteId: string;
  points: TechFingerprintHistoryPoint[];
}

/** Benchmarking-ready percentile rank — null until real cohort data is available. */
export interface BenchmarkPercentile {
  metric: 'security_score' | 'ssl_health' | 'uptime' | 'change_stability';
  percentile: number | null;
  cohortLabel: string;
  sampleSize: number | null;
}

export interface WebsiteHistoricalIntelligence {
  websiteId: string;
  score: ScoreHistory;
  ssl: SslHistory;
  changes: ChangeHistory;
  uptime: UptimeHistory;
  findings: FindingHistory;
  techFingerprint: TechFingerprintHistory;
  benchmarks: BenchmarkPercentile[];
}

export interface OrgHistoricalIntelligence {
  orgId: string;
  websites: WebsiteHistoricalIntelligence[];
  aggregatedScoreTrend: number | null;
  lastUpdatedAt: string;
}
