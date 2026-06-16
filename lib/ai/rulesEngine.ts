import type { ScanResult } from '@/lib/scanner/runScan';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RuleFinding {
  rule: string;
  deduction: number;
  severity: RuleSeverity;
  message: string;
}

export interface RulesEngineResult {
  baseScore: number;
  adjustedScore: number;
  findings: RuleFinding[];
  riskLevel: ScanResult['riskLevel'];
}

function scoreToRiskLevel(score: number): ScanResult['riskLevel'] {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
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

/** Deterministic rules-based scoring — no AI. CSP −10, HSTS −8, external scripts medium, SSL critical. */
export function applyRulesEngine(scan: ScanResult): RulesEngineResult {
  const findings: RuleFinding[] = [];
  let adjustedScore = scan.score;

  if (!scan.ssl) {
    findings.push({
      rule: 'ssl_missing',
      deduction: 0,
      severity: 'critical',
      message: 'No HTTPS — traffic is transmitted in plaintext',
    });
  }

  if (!scan.headers.csp) {
    adjustedScore = Math.max(0, adjustedScore - 10);
    findings.push({
      rule: 'csp_missing',
      deduction: 10,
      severity: 'high',
      message: 'Missing Content-Security-Policy header — increases XSS risk',
    });
  }

  if (!scan.headers.hsts) {
    adjustedScore = Math.max(0, adjustedScore - 8);
    findings.push({
      rule: 'hsts_missing',
      deduction: 8,
      severity: 'high',
      message: 'Missing Strict-Transport-Security (HSTS) header',
    });
  }

  const externalScripts = scan.pageSnapshot.scripts.filter((s) => isExternalScript(s, scan.url));
  if (externalScripts.length > 0) {
    findings.push({
      rule: 'external_scripts',
      deduction: 0,
      severity: 'medium',
      message: `${externalScripts.length} external script(s) detected — review third-party dependencies`,
    });
  }

  return {
    baseScore: scan.score,
    adjustedScore,
    findings,
    riskLevel: scoreToRiskLevel(adjustedScore),
  };
}
