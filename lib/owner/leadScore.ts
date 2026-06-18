import type { ScanResult } from '@/lib/scanner/runScan';
import type { LeadScore } from './types';

export function computeLeadScore(scan: Pick<ScanResult, 'score' | 'riskLevel' | 'issues'>): LeadScore {
  const issueCount = scan.issues?.length ?? 0;
  const score = scan.score ?? 0;
  const risk = scan.riskLevel;

  if (risk === 'critical' || risk === 'high' || score < 50 || issueCount >= 5) {
    return 'HOT';
  }
  if (risk === 'medium' || score < 75 || issueCount >= 2) {
    return 'WARM';
  }
  return 'LOW';
}

export function leadScoreColor(score: LeadScore | null): string {
  switch (score) {
    case 'HOT':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'WARM':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'LOW':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}
