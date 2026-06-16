import type { ScanResult } from '@/lib/scanner/runScan';

import type { Severity } from './types';



export const SEVERITY_DEDUCTIONS: Record<Severity, number> = {

  critical: 25,

  high: 15,

  medium: 8,

  low: 3,

};



export function scoreToRiskLevel(score: number): ScanResult['riskLevel'] {

  if (score >= 80) return 'low';

  if (score >= 60) return 'medium';

  if (score >= 40) return 'high';

  return 'critical';

}



export function computeSecurityScore(findings: Array<{ severity: Severity }>): number {

  let score = 100;

  for (const finding of findings) {

    score -= SEVERITY_DEDUCTIONS[finding.severity];

  }

  return Math.max(0, Math.min(100, score));

}



export { computeAttackSurfaceScore, classifyAttackSurface, describeAttackSurface } from './attackSurface';

