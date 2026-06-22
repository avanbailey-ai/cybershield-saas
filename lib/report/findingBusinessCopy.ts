import type { FindingCategory, SecurityFinding, Severity } from '@/lib/securityIntelligence/types';

export type FindingPriorityLabel = 'Urgent' | 'Recommended' | 'Optional';

export interface BusinessFindingCopy {
  plainTitle: string;
  whatWeFound: string;
  whyItMatters: string;
  developerAction: string;
  priorityLabel: FindingPriorityLabel;
  /** True when this is configuration/exposure detection, not a confirmed exploit. */
  notConfirmedVulnerability: boolean;
}

const ID_COPY: Record<string, Omit<BusinessFindingCopy, 'notConfirmedVulnerability'>> = {
  external_scripts: {
    plainTitle: 'Third-party scripts are loaded on your website',
    whatWeFound: 'Your site loads scripts from outside services.',
    whyItMatters:
      'Outside scripts are common, but they add dependencies. If one changes or breaks, it can affect customer trust, tracking, performance, or security.',
    developerAction:
      'Review script sources, remove unused scripts, and monitor future script changes.',
    priorityLabel: 'Recommended',
  },
  third_party_dependencies: {
    plainTitle: 'Known third-party services are connected to your site',
    whatWeFound: 'We detected third-party script or service dependencies on this page.',
    whyItMatters:
      'Each vendor is another moving part. Updates, outages, or policy changes at a vendor can affect how your site behaves for customers.',
    developerAction:
      'Maintain a vendor list, remove unused integrations, and set a quarterly review cadence.',
    priorityLabel: 'Recommended',
  },
  analytics_tracking: {
    plainTitle: 'Analytics or tracking tools are active',
    whatWeFound: 'Tracking or analytics scripts were detected on your site.',
    whyItMatters:
      'Tracking helps marketing, but it also affects privacy expectations and page performance. Misconfigured tags can leak data or slow load times.',
    developerAction:
      'Confirm tracking matches your privacy policy, remove unused tags, and document who owns each tool.',
    priorityLabel: 'Optional',
  },
  auth_endpoints: {
    plainTitle: 'Login/Admin routes were detected',
    whatWeFound: 'We detected login or authentication-related paths in your public page surface.',
    whyItMatters:
      'Login routes are normal for many businesses. What matters is that they stay protected with HTTPS, rate limiting, and secure session handling.',
    developerAction:
      'Ask your developer to confirm login routes use HTTPS, rate limiting, and secure cookies.',
    priorityLabel: 'Recommended',
  },
  login_surface: {
    plainTitle: 'A login form is exposed on this page',
    whatWeFound: 'A sign-in or account form is reachable from the scanned page.',
    whyItMatters:
      'Customer login pages are high-trust surfaces. Weak protections can affect account safety and brand confidence — not necessarily an active breach.',
    developerAction:
      'Verify brute-force protection, MFA options, and that credentials are never sent over insecure connections.',
    priorityLabel: 'Recommended',
  },
  admin_endpoints: {
    plainTitle: 'Admin paths are discoverable',
    whatWeFound: 'Administrative URL paths appear in your site’s public surface scan.',
    whyItMatters:
      'Discoverable admin paths are not a confirmed breach, but they can make unwanted probing easier if protections are weak.',
    developerAction:
      'Restrict admin access, require strong authentication, and avoid exposing admin URLs in public pages.',
    priorityLabel: 'Recommended',
  },
  external_api_calls: {
    plainTitle: 'External services or API connections were detected',
    whatWeFound: 'The page references external API or service endpoints from the browser.',
    whyItMatters:
      'External connections are often required for features like maps, chat, or payments. They should be reviewed so secrets stay server-side and vendors stay trusted.',
    developerAction:
      'Review each external connection, confirm no private keys in client code, and document approved vendors.',
    priorityLabel: 'Recommended',
  },
};

const CATEGORY_FALLBACK: Record<
  FindingCategory,
  Omit<BusinessFindingCopy, 'plainTitle' | 'whatWeFound' | 'notConfirmedVulnerability'>
> = {
  headers: {
    whyItMatters:
      'Browser security headers help protect visitors from common web issues like clickjacking and script abuse. Missing headers are configuration gaps — not proof of an active attack.',
    developerAction:
      'Ask your host or developer to add the recommended security headers and verify with a follow-up scan.',
    priorityLabel: 'Recommended',
  },
  transport: {
    whyItMatters:
      'Encrypted connections (HTTPS) are a baseline trust signal for customers, partners, and search engines.',
    developerAction:
      'Enable HTTPS across the entire site and confirm certificates renew automatically.',
    priorityLabel: 'Urgent',
  },
  third_party: {
    whyItMatters:
      'Third-party tools can improve your site, but each one adds a dependency that can change without notice.',
    developerAction:
      'Review vendors, remove unused scripts, and schedule periodic dependency checks.',
    priorityLabel: 'Recommended',
  },
  authentication: {
    whyItMatters:
      'Account and login flows affect customer trust. Configuration gaps here deserve review even when no breach is confirmed.',
    developerAction:
      'Confirm HTTPS, rate limiting, secure cookies, and MFA for privileged accounts.',
    priorityLabel: 'Recommended',
  },
  attack_surface: {
    whyItMatters:
      'Publicly visible endpoints and scripts are worth reviewing. Detection alone does not mean your site is compromised.',
    developerAction:
      'Review exposed paths with your developer and remove anything that should not be public.',
    priorityLabel: 'Recommended',
  },
};

function priorityFromSeverity(severity: Severity): FindingPriorityLabel {
  if (severity === 'critical' || severity === 'high') return 'Urgent';
  if (severity === 'medium') return 'Recommended';
  return 'Optional';
}

function isExposureFinding(finding: SecurityFinding): boolean {
  const exposureIds = new Set([
    'external_scripts',
    'third_party_dependencies',
    'analytics_tracking',
    'auth_endpoints',
    'login_surface',
    'admin_endpoints',
    'external_api_calls',
  ]);
  if (exposureIds.has(finding.id)) return true;
  return finding.severity === 'medium' || finding.severity === 'low';
}

function humanizeTitle(title: string): string {
  return title
    .replace(/^Missing /i, 'Missing protection: ')
    .replace(/ header missing$/i, ' is not configured')
    .replace(/ not present\.?$/i, ' is not active');
}

export function buildBusinessFindingCopy(finding: SecurityFinding): BusinessFindingCopy {
  const byId = ID_COPY[finding.id];
  if (byId) {
    return {
      ...byId,
      notConfirmedVulnerability: isExposureFinding(finding),
    };
  }

  const fallback = CATEGORY_FALLBACK[finding.category];
  const priority = priorityFromSeverity(finding.severity);
  const transportUrgent = finding.category === 'transport' && priority === 'Urgent';

  return {
    plainTitle: humanizeTitle(finding.title),
    whatWeFound: finding.description.endsWith('.')
      ? finding.description
      : `${finding.description}.`,
    whyItMatters:
      finding.impact[0] ??
      fallback.whyItMatters,
    developerAction: finding.fix.split('\n')[0] ?? fallback.developerAction,
    priorityLabel: transportUrgent ? 'Urgent' : priority,
    notConfirmedVulnerability:
      finding.severity !== 'critical' && finding.category !== 'transport',
  };
}
