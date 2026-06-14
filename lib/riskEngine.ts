import type { ScanResult } from './scanner/runScan';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  findings: string[];
  recommendations: string[];
  explanation: string;
}

export function assessRisk(scan: ScanResult): RiskAssessment {
  return {
    riskScore: 100 - scan.score,
    riskLevel: scan.riskLevel,
    findings: scan.issues,
    recommendations: generateRecommendations(scan),
    explanation: scan.explanation,
  };
}

function generateRecommendations(scan: ScanResult): string[] {
  const recs: string[] = [];
  if (!scan.ssl) recs.push('Enable HTTPS with a valid SSL/TLS certificate');
  if (!scan.headers.csp) recs.push('Add Content-Security-Policy header to prevent XSS');
  if (!scan.headers.hsts) recs.push('Add Strict-Transport-Security header');
  if (!scan.headers.xFrame) recs.push('Add X-Frame-Options: DENY to prevent clickjacking');
  if (!scan.headers.xContentType) recs.push('Add X-Content-Type-Options: nosniff');
  if (!scan.headers.referrerPolicy) recs.push('Add Referrer-Policy header');
  if (!scan.headers.permissionsPolicy) recs.push('Add Permissions-Policy header');
  return recs;
}
