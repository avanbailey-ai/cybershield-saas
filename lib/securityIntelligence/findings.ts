import type { ScanResult } from '@/lib/scanner/runScan';
import type { SecurityFinding } from './types';

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

const HEADER_FINDINGS: Array<{
  id: string;
  key: keyof ScanResult['headers'];
  title: string;
  severity: SecurityFinding['severity'];
  explanation: string;
}> = [
  {
    id: 'csp_missing',
    key: 'csp',
    title: 'Missing Content-Security-Policy',
    severity: 'high',
    explanation: 'No CSP header — increases XSS and data injection risk',
  },
  {
    id: 'hsts_missing',
    key: 'hsts',
    title: 'Missing Strict-Transport-Security',
    severity: 'high',
    explanation: 'No HSTS header — connections can be downgraded to HTTP',
  },
  {
    id: 'xframe_missing',
    key: 'xFrame',
    title: 'Missing X-Frame-Options',
    severity: 'high',
    explanation: 'Site may be embedded in malicious frames (clickjacking)',
  },
  {
    id: 'xcontenttype_missing',
    key: 'xContentType',
    title: 'Missing X-Content-Type-Options',
    severity: 'medium',
    explanation: 'MIME-sniffing attacks may be possible',
  },
  {
    id: 'referrer_missing',
    key: 'referrerPolicy',
    title: 'Missing Referrer-Policy',
    severity: 'medium',
    explanation: 'Sensitive URL parameters may leak to third parties',
  },
  {
    id: 'permissions_missing',
    key: 'permissionsPolicy',
    title: 'Missing Permissions-Policy',
    severity: 'medium',
    explanation: 'Browser features (camera, geolocation) are unrestricted',
  },
];

/** Deterministic findings from scan signals — no AI. */
export function generateFindings(scan: ScanResult): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  if (!scan.ssl) {
    findings.push({
      id: 'ssl_missing',
      title: 'No HTTPS',
      severity: 'critical',
      explanation: 'Traffic is transmitted in plaintext without TLS encryption',
    });
  }

  for (const header of HEADER_FINDINGS) {
    if (!scan.headers[header.key]) {
      findings.push({
        id: header.id,
        title: header.title,
        severity: header.severity,
        explanation: header.explanation,
      });
    }
  }

  const externalScripts = scan.pageSnapshot.scripts.filter((s) => isExternalScript(s, scan.url));
  if (externalScripts.length > 0) {
    findings.push({
      id: 'external_scripts',
      title: 'External third-party scripts',
      severity: 'medium',
      explanation: `${externalScripts.length} script(s) loaded from external domains — expands supply-chain risk`,
    });
  }

  if (scan.pageSnapshot.thirdPartyScripts.length > 0) {
    findings.push({
      id: 'third_party_dependencies',
      title: 'Third-party script dependencies',
      severity: 'low',
      explanation: `${scan.pageSnapshot.thirdPartyScripts.length} known third-party dependency(s) detected`,
    });
  }

  if (scan.pageSnapshot.loginFormDetected) {
    findings.push({
      id: 'login_surface',
      title: 'Login form detected',
      severity: 'medium',
      explanation: 'Authentication surface exposed — ensure brute-force protection and secure cookies',
    });
  }

  const adminEndpoints = scan.pageSnapshot.endpoints.filter((e) => /\/admin/i.test(e));
  if (adminEndpoints.length > 0) {
    findings.push({
      id: 'admin_endpoints',
      title: 'Admin endpoints exposed',
      severity: 'high',
      explanation: `${adminEndpoints.length} admin path(s) found: ${adminEndpoints.slice(0, 3).join(', ')}`,
    });
  }

  const authEndpoints = scan.pageSnapshot.endpoints.filter((e) => /\/auth|\/login/i.test(e));
  if (authEndpoints.length > 0) {
    findings.push({
      id: 'auth_endpoints',
      title: 'Authentication endpoints detected',
      severity: 'medium',
      explanation: `${authEndpoints.length} auth-related path(s) visible in page surface`,
    });
  }

  if (scan.pageSnapshot.techFingerprint.analytics.length > 0) {
    findings.push({
      id: 'analytics_tracking',
      title: 'Analytics/tracking scripts',
      severity: 'low',
      explanation: `Tracking detected: ${scan.pageSnapshot.techFingerprint.analytics.join(', ')}`,
    });
  }

  if (scan.pageSnapshot.externalApiCalls.length > 0) {
    findings.push({
      id: 'external_api_calls',
      title: 'External API calls',
      severity: 'medium',
      explanation: `${scan.pageSnapshot.externalApiCalls.length} external API/script origin(s) referenced`,
    });
  }

  return findings;
}
