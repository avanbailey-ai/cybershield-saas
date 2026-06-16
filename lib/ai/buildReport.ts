import type { Plan } from '@/lib/billing/plans';
import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import { buildRiskBreakdown, type RiskBreakdown } from '@/lib/scanner/riskBreakdown';
import { computeScanHash } from './scanHash';
import {
  runSecurityIntelligence,
  toLegacySecurityReport,
  type SecurityIntelligenceReport,
} from '@/lib/securityIntelligence/engine';
import type { SecurityReport } from './generateSecurityReport';

export type AiReportStatus = 'deterministic' | 'skipped';

export interface BuildReportInput {
  scanResult: ScanResult;
  websiteId: string | null;
  userId: string | null;
  plan: Plan;
  previousScan?: {
    securityScore: number | null;
    issues: string[] | null;
    snapshot: ScanSnapshot | null;
  } | null;
}

export interface BuildReportOutput {
  scanResult: ScanResult;
  intelligence: SecurityIntelligenceReport;
  riskBreakdown: RiskBreakdown;
  report: SecurityReport;
  aiStatus: AiReportStatus;
  scanHash: string;
}

/**
 * Orchestrator: Scan → Security Intelligence Engine → Structured Report
 * Deterministic only — no OpenAI in core path.
 */
export async function buildReport(input: BuildReportInput): Promise<BuildReportOutput> {
  const { scanResult, previousScan = null } = input;

  const intelligence = runSecurityIntelligence({ scanResult, previousScan });
  const riskBreakdown = buildRiskBreakdown(scanResult);
  const report = toLegacySecurityReport(intelligence);
  const scanHash = computeScanHash(scanResult);

  return {
    scanResult,
    intelligence,
    riskBreakdown,
    report,
    aiStatus: 'deterministic',
    scanHash,
  };
}
