import type { ScanResult } from '@/lib/scanner/runScan';
import { runSecurityIntelligence, toLegacySecurityReport } from '@/lib/securityIntelligence/engine';

export interface SecurityReport {
  summary: string;
  riskScoreExplanation: string;
  vulnerabilities: Array<{ title: string; severity: string; description: string }>;
  businessImpact: string;
  recommendations: string[];
  urgencyStatement?: string;
}

/** Deterministic report via Security Intelligence Engine — no OpenAI. */
export function buildTemplateReport(scanResult: ScanResult): SecurityReport {
  const intel = runSecurityIntelligence({ scanResult });
  return toLegacySecurityReport(intel);
}

/** Default export: deterministic engine only. */
export async function generateSecurityReport(scanResult: ScanResult): Promise<SecurityReport> {
  return buildTemplateReport(scanResult);
}
