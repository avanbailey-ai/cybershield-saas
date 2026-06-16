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

function isExternalScript(script: string, siteUrl: string): boolean {
  if (script.startsWith('inline:')) return false;
  try {
    const base = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
    const src = script.startsWith('http') ? script : `https://${script.replace(/^\/\//, '')}`;
    const parsed = new URL(src);
    return parsed.hostname !== base.hostname;
  } catch {
    return /cdn|googleapis|cloudflare|unpkg|jsdelivr|gstatic/i.test(script);
  }
}

/** Attack surface: external scripts, domains, forms, auth endpoints — higher exposure = lower score. */
export function computeAttackSurfaceScore(scan: ScanResult): number {
  let exposure = 0;
  const externalScripts = scan.pageSnapshot.scripts.filter((s) => isExternalScript(s, scan.url));
  exposure += externalScripts.length * 5;
  exposure += scan.pageSnapshot.thirdPartyScripts.length * 3;
  exposure += scan.pageSnapshot.endpoints.filter((e) => /\/admin|\/auth|\/login/i.test(e)).length * 8;
  if (scan.pageSnapshot.loginFormDetected) exposure += 5;
  exposure += scan.pageSnapshot.formsDetected * 2;
  return Math.max(0, Math.min(100, 100 - exposure));
}
