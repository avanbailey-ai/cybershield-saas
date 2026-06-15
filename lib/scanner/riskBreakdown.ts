import type { ScanResult } from './runScan';

export interface RiskCategoryBreakdown {
  label: string;
  score: number;
  maxScore: number;
  issues: string[];
  passed: string[];
}

export interface RiskBreakdown {
  transport: RiskCategoryBreakdown;
  headers: RiskCategoryBreakdown;
  overall: { score: number; riskLevel: ScanResult['riskLevel'] };
}

function headerChecks(scan: ScanResult): { passed: string[]; issues: string[]; score: number } {
  const passed: string[] = [];
  const issues: string[] = [];
  let score = 100;

  const checks: Array<{ key: keyof ScanResult['headers']; label: string; weight: number }> = [
    { key: 'csp', label: 'Content-Security-Policy', weight: 20 },
    { key: 'hsts', label: 'Strict-Transport-Security', weight: 15 },
    { key: 'xFrame', label: 'X-Frame-Options', weight: 15 },
    { key: 'xContentType', label: 'X-Content-Type-Options', weight: 10 },
    { key: 'referrerPolicy', label: 'Referrer-Policy', weight: 10 },
    { key: 'permissionsPolicy', label: 'Permissions-Policy', weight: 10 },
  ];

  for (const check of checks) {
    if (scan.headers[check.key]) {
      passed.push(check.label);
    } else {
      issues.push(`Missing ${check.label}`);
      score -= check.weight;
    }
  }

  return { passed, issues, score: Math.max(0, score) };
}

/** Build categorized risk breakdown for scan result display and persistence. */
export function buildRiskBreakdown(scan: ScanResult): RiskBreakdown {
  const transportIssues: string[] = [];
  const transportPassed: string[] = [];
  let transportScore = 100;

  if (!scan.ssl) {
    transportScore = 0;
    transportIssues.push('No HTTPS — traffic is transmitted in plaintext');
  } else {
    transportPassed.push('HTTPS/SSL enabled');
  }

  const headers = headerChecks(scan);

  return {
    transport: {
      label: 'Transport Security',
      score: transportScore,
      maxScore: 100,
      issues: transportIssues,
      passed: transportPassed,
    },
    headers: {
      label: 'Security Headers',
      score: headers.score,
      maxScore: 100,
      issues: headers.issues,
      passed: headers.passed,
    },
    overall: {
      score: scan.score,
      riskLevel: scan.riskLevel,
    },
  };
}
