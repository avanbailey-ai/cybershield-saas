import type { PublicScanResult } from '@/components/conversion/ScanResultPaywall';

function shortenIssue(issue: string, max = 56): string {
  const trimmed = issue.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  return cut.endsWith(' ') ? `${cut.trim()}…` : `${cut}…`;
}

/** Strip raw severity prefixes from intelligence issue strings (display only). */
export function stripSeverityPrefix(issue: string): string {
  let text = issue.trim();
  text = text.replace(/^\[(critical|high|medium|low)\]\s*/i, '');
  text = text.replace(/^(critical|high|medium|low):\s*/i, '');
  const emDash = text.indexOf(' — ');
  if (emDash >= 0) text = text.slice(0, emDash);
  return text.trim();
}

function deriveTopConcern(issues: string[]): string {
  if (issues.length === 0) return 'Missing security headers';
  return shortenIssue(stripSeverityPrefix(issues[0])).replace(/\.$/, '');
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
