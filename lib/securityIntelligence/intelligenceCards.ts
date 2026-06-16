import type { ScanResult } from '@/lib/scanner/runScan';

import type { SecurityFinding, SecurityIntelligenceCard } from './types';

import { EXPLOIT_RULES } from './exploitContext';



export interface CardTrigger {

  id: string;

  title: string;

  /** Return true when this finding applies to the scan. */

  detect: (scan: ScanResult) => boolean;

  /** Optional dynamic description override based on scan context. */

  describe?: (scan: ScanResult) => string;

}



function buildCard(

  id: string,

  title: string,

  scan: ScanResult,

  describe?: (scan: ScanResult) => string,

): SecurityIntelligenceCard | null {

  const rule = EXPLOIT_RULES[id];

  if (!rule) return null;



  return {

    title,

    severity: rule.severity,

    category: rule.category,

    description: describe ? describe(scan) : rule.exploitScenario.split('.')[0] + '.',

    impact: rule.impact,

    exploitScenario: rule.exploitScenario,

    fix: rule.fix,

    securityImpactIfFixed: rule.securityImpactIfFixed,

  };

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



/** Rule-based card triggers — deterministic, no AI. */

export const CARD_TRIGGERS: CardTrigger[] = [

  {

    id: 'ssl_missing',

    title: 'No HTTPS / TLS Encryption',

    detect: (scan) => !scan.ssl,

    describe: () =>

      'Site is served over unencrypted HTTP. All traffic between users and your server is transmitted in plaintext.',

  },

  {

    id: 'csp_missing',

    title: 'Missing Content-Security-Policy',

    detect: (scan) => !scan.headers.csp,

    describe: () =>

      'No Content-Security-Policy header detected. The browser has no enforced allowlist for scripts, styles, or resource origins.',

  },

  {

    id: 'hsts_missing',

    title: 'Missing Strict-Transport-Security (HSTS)',

    detect: (scan) => !scan.headers.hsts,

    describe: () =>

      'HSTS header is absent. Browsers will not enforce HTTPS-only connections, leaving first-request and downgrade paths open.',

  },

  {

    id: 'xframe_missing',

    title: 'Missing X-Frame-Options',

    detect: (scan) => !scan.headers.xFrame,

    describe: () =>

      'X-Frame-Options header not set. Your site can be embedded in third-party iframes, enabling clickjacking attacks.',

  },

  {

    id: 'xcontenttype_missing',

    title: 'Missing X-Content-Type-Options',

    detect: (scan) => !scan.headers.xContentType,

    describe: () =>

      'X-Content-Type-Options: nosniff is not configured. Browsers may MIME-sniff responses and execute content unexpectedly.',

  },

  {

    id: 'referrer_missing',

    title: 'Missing Referrer-Policy',

    detect: (scan) => !scan.headers.referrerPolicy,

    describe: () =>

      'Referrer-Policy header is missing. Full URLs including sensitive query parameters may leak to third-party sites.',

  },

  {

    id: 'permissions_missing',

    title: 'Missing Permissions-Policy',

    detect: (scan) => !scan.headers.permissionsPolicy,

    describe: () =>

      'Permissions-Policy header not present. Browser features like camera, microphone, and geolocation are unrestricted for all scripts.',

  },

  {

    id: 'external_scripts',

    title: 'External Third-Party Scripts',

    detect: (scan) => scan.pageSnapshot.scripts.some((s) => isExternalScript(s, scan.url)),

    describe: (scan) => {

      const count = scan.pageSnapshot.scripts.filter((s) => isExternalScript(s, scan.url)).length;

      return `${count} script(s) loaded from external domains, expanding supply-chain trust boundaries.`;

    },

  },

  {

    id: 'third_party_dependencies',

    title: 'Third-Party Script Dependencies',

    detect: (scan) => scan.pageSnapshot.thirdPartyScripts.length > 0,

    describe: (scan) =>

      `${scan.pageSnapshot.thirdPartyScripts.length} known third-party dependency(ies) detected: ${scan.pageSnapshot.thirdPartyScripts.slice(0, 5).join(', ')}${scan.pageSnapshot.thirdPartyScripts.length > 5 ? '…' : ''}.`,

  },

  {

    id: 'login_surface',

    title: 'Login Form Detected',

    detect: (scan) => scan.pageSnapshot.loginFormDetected,

    describe: () =>

      'An authentication form is exposed on this page. Credential-based attacks (brute force, stuffing) can target this surface.',

  },

  {

    id: 'admin_endpoints',

    title: 'Admin Endpoints Exposed',

    detect: (scan) => scan.pageSnapshot.endpoints.some((e) => /\/admin/i.test(e)),

    describe: (scan) => {

      const paths = scan.pageSnapshot.endpoints.filter((e) => /\/admin/i.test(e));

      return `${paths.length} admin path(s) discoverable in page surface: ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? '…' : ''}.`;

    },

  },

  {

    id: 'auth_endpoints',

    title: 'Authentication Endpoints Detected',

    detect: (scan) => scan.pageSnapshot.endpoints.some((e) => /\/auth|\/login/i.test(e)),

    describe: (scan) => {

      const paths = scan.pageSnapshot.endpoints.filter((e) => /\/auth|\/login/i.test(e));

      return `${paths.length} auth-related path(s) visible: ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? '…' : ''}.`;

    },

  },

  {

    id: 'analytics_tracking',

    title: 'Analytics / Tracking Scripts',

    detect: (scan) => scan.pageSnapshot.techFingerprint.analytics.length > 0,

    describe: (scan) =>

      `Tracking providers detected: ${scan.pageSnapshot.techFingerprint.analytics.join(', ')}. Review data collection and consent requirements.`,

  },

  {

    id: 'external_api_calls',

    title: 'External API Calls',

    detect: (scan) => scan.pageSnapshot.externalApiCalls.length > 0,

    describe: (scan) =>

      `${scan.pageSnapshot.externalApiCalls.length} external API/script origin(s) referenced from the page. Verify no secrets are exposed client-side.`,

  },

];



/** Evaluate all card triggers against a scan and return enterprise findings. */

export function generateIntelligenceCards(scan: ScanResult): SecurityFinding[] {

  const findings: SecurityFinding[] = [];



  for (const trigger of CARD_TRIGGERS) {

    if (!trigger.detect(scan)) continue;



    const card = buildCard(trigger.id, trigger.title, scan, trigger.describe);

    if (!card) continue;



    findings.push({ id: trigger.id, ...card });

  }



  return findings;

}



/** Format a finding card into a legacy vulnerability description string. */

export function formatFindingForLegacy(finding: SecurityFinding): string {

  const impactBlock = finding.impact.map((i) => `• ${i}`).join('\n');

  return [

    finding.description,

    '',

    'Impact:',

    impactBlock,

    '',

    'Exploit scenario:',

    finding.exploitScenario,

    '',

    'Remediation:',

    finding.fix,

    '',

    'If fixed:',

    finding.securityImpactIfFixed,

  ].join('\n');

}

