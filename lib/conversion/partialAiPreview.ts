import type { PublicScanResult } from '@/components/conversion/ScanResultPaywall';

function shortenIssue(issue: string, max = 56): string {
  const trimmed = issue.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  return cut.endsWith(' ') ? `${cut.trim()}…` : `${cut}…`;
}

function deriveTopConcern(issues: string[]): string {
  if (issues.length === 0) return 'missing security headers';
  return shortenIssue(issues[0]).replace(/\.$/, '').toLowerCase();
}

export interface PartialAiPreviewContent {
  headline: string;
  topConcern: string;
  riskSummary: string;
  unlockHint: string;
}

export function buildPartialAiPreview(result: PublicScanResult): PartialAiPreviewContent {
  const score = result.score;
  const highRisk =
    result.riskDetected ||
    result.riskLevel === 'high' ||
    result.riskLevel === 'critical' ||
    (score !== null && score < 70);

  return {
    headline: highRisk
      ? 'CyberShield found high-risk security gaps.'
      : 'CyberShield completed your security scan.',
    topConcern: `Top concern: ${deriveTopConcern(result.issues)}.`,
    riskSummary:
      'Your site may be exposed to XSS, clickjacking, or downgrade risks.',
    unlockHint:
      'Unlock the full report to see exploit scenarios and exact fixes.',
  };
}
