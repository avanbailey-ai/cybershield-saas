import type { Plan } from '@/lib/billing/plans';
import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import { buildRiskBreakdown, type RiskBreakdown } from '@/lib/scanner/riskBreakdown';
import { applyRulesEngine, type RulesEngineResult } from './rulesEngine';
import { detectAiRelevantChanges, type AiChangeSignal } from './changeDetection';
import { computeScanHash } from './scanHash';
import { getCachedAiReport, getTimestampBucket, setCachedAiReport } from './reportCache';
import { evaluateAiGate, type AiGateDecision } from './aiGate';
import { getAiDailyUsage, incrementAiDailyUsage } from './usageLimiter';
import {
  buildTemplateReport,
  enhanceReportWithAi,
  type SecurityReport,
} from './generateSecurityReport';

export type AiReportStatus = 'used' | 'skipped' | 'cached';

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
  rulesResult: RulesEngineResult;
  riskBreakdown: RiskBreakdown;
  report: SecurityReport;
  aiStatus: AiReportStatus;
  aiSkipReason?: string;
  changeSignal: AiChangeSignal;
  aiGate: AiGateDecision;
  scanHash: string;
}

/**
 * Orchestrator: Scan → Rules Engine → Change Detection → Cache Check → (optional AI) → Final Report
 * AI is event-driven only — called when changes are detected and plan quota allows.
 */
export async function buildReport(input: BuildReportInput): Promise<BuildReportOutput> {
  const { scanResult, websiteId, userId, plan, previousScan = null } = input;

  const rulesResult = applyRulesEngine(scanResult);
  const riskBreakdown = buildRiskBreakdown(scanResult);
  const changeSignal = detectAiRelevantChanges({
    previousScan,
    currentScan: scanResult,
  });

  const scanHash = computeScanHash(scanResult);
  const bucket = getTimestampBucket();

  const cached = await getCachedAiReport({ websiteId, scanHash, bucket });
  if (cached) {
    return {
      scanResult,
      rulesResult,
      riskBreakdown,
      report: cached,
      aiStatus: 'cached',
      changeSignal,
      aiGate: { allowed: false, reason: 'no_change' as const },
      scanHash,
    };
  }

  let report = buildTemplateReport(scanResult);
  const dailyUsage = await getAiDailyUsage(userId);
  const aiGate = evaluateAiGate({ plan, changeSignal, dailyUsage, userId });

  if (aiGate.allowed) {
    report = await enhanceReportWithAi(report, scanResult);
    await setCachedAiReport({ websiteId, scanHash, bucket, report });
    if (userId) {
      await incrementAiDailyUsage(userId);
    }
    return {
      scanResult,
      rulesResult,
      riskBreakdown,
      report,
      aiStatus: 'used',
      changeSignal,
      aiGate,
      scanHash,
    };
  }

  return {
    scanResult,
    rulesResult,
    riskBreakdown,
    report,
    aiStatus: 'skipped',
    aiSkipReason: aiGate.reason,
    changeSignal,
    aiGate,
    scanHash,
  };
}
