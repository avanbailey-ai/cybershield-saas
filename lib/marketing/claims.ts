/**
 * Approved public product language and banned phrases.
 * Use when adding marketing copy, emails, or SEO text.
 */

export const SUPPORT_EMAIL = 'support@cybershieldcloud.com';
export const SALES_EMAIL = 'sales@cybershieldcloud.com';
export const PARTNERS_EMAIL = 'partners@cybershieldcloud.com';
export const OUTREACH_EMAIL = 'outreach@cybershieldcloud.com';

/** Safe, accurate positioning statements */
export const APPROVED_CLAIMS = [
  'CyberShield helps detect common website security configuration issues.',
  'CyberShield monitors websites on a schedule that matches your paid plan.',
  'CyberShield identifies security header, SSL/TLS, and page-structure signals.',
  'CyberShield provides plain-English findings and remediation guidance.',
  'CyberShield sends email alerts when supported changes or issues are detected.',
  'Free scan is a one-time preview; ongoing monitoring requires a paid plan.',
] as const;

/** Do not use in public-facing copy without legal review and code proof */
export const BANNED_PHRASES = [
  'guarantees security',
  'prevents hacks',
  'fully protects',
  'stops attacks',
  'real-time threat prevention',
  'AI fixes your website automatically',
  '24/7 human support',
  'SOC 2 compliant',
  'SOC2 certified',
  'penetration testing included',
  'vulnerability exploitation',
  'malware scanning',
  'before attackers do',
  'enterprise-grade compliance automation',
] as const;

/** What each plan actually includes (see lib/billing/plans.ts + scanFrequency.ts) */
export const PLAN_CLAIMS = {
  free: {
    websites: 1,
    monitoring: 'None (manual scans only; public free scan is preview-only)',
    freeScanPreviewIssues: 2,
  },
  pro: {
    priceUsd: 79,
    websites: 10,
    monitoring: 'Daily checks + weekly deep scan',
    manualDeepScansPerDay: 10,
  },
  growth: {
    priceUsd: 149,
    websites: 50,
    monitoring: 'Hourly checks + weekly deep scan',
    manualDeepScansPerDay: 50,
  },
  agency: {
    priceUsd: 299,
    websites: 250,
    monitoring: 'Hourly checks; 25 priority sites every 5 minutes',
    manualDeepScansPerDay: 100,
  },
  enterprise: {
    priceUsd: 'custom',
    note: 'Contact sales — not self-serve checkout',
  },
} as const;

/** Implemented scan checks (presence/heuristic — not penetration testing) */
export const IMPLEMENTED_SCAN_CHECKS = [
  'HTTPS/TLS usage',
  'SSL certificate expiry',
  'Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) — presence only',
  'External scripts and third-party dependencies (homepage HTML)',
  'Login forms and linked admin/auth paths (homepage HTML)',
  'DNS reachability and HTTP status (monitoring checks)',
  'Domain registration expiry (RDAP, scheduled job)',
  'Change detection between scans (headers, SSL, scripts on deep scans)',
] as const;

/** Mentioned in marketing historically but NOT implemented */
export const NOT_IMPLEMENTED = [
  'Malware / blacklist monitoring',
  'Active vulnerability exploitation testing',
  'CVE / plugin version database',
  'Port scanning',
  'SSO/SAML (self-serve)',
  'SOC 2 certification or attestation',
  'Dedicated human SLA support (self-serve)',
  'White-label branded reports',
  'Per-scan PDF export (HTML reports + agency .txt copy; org PDF for agency admins)',
] as const;
