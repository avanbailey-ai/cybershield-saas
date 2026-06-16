import type { SecurityFinding, SecurityRecommendation } from './types';

const RECOMMENDATION_MAP: Record<string, { title: string; steps: string[] }> = {
  ssl_missing: {
    title: 'Enable HTTPS',
    steps: [
      'Obtain an SSL/TLS certificate from your hosting provider or Let\'s Encrypt',
      'Configure your web server to serve HTTPS and redirect HTTP to HTTPS',
      'Verify certificate chain and set auto-renewal',
    ],
  },
  csp_missing: {
    title: 'Add Content-Security-Policy',
    steps: [
      'Define a CSP policy starting with default-src \'self\'',
      'Add script-src and style-src directives for your trusted sources',
      'Deploy via HTTP header: Content-Security-Policy: default-src \'self\'',
    ],
  },
  hsts_missing: {
    title: 'Add Strict-Transport-Security',
    steps: [
      'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      'Ensure HTTPS is fully working before enabling HSTS',
      'Consider preload registration after validation',
    ],
  },
  xframe_missing: {
    title: 'Add X-Frame-Options',
    steps: [
      'Add header: X-Frame-Options: DENY (or SAMEORIGIN if framing is required)',
      'Alternatively use CSP frame-ancestors directive',
    ],
  },
  xcontenttype_missing: {
    title: 'Add X-Content-Type-Options',
    steps: ['Add header: X-Content-Type-Options: nosniff'],
  },
  referrer_missing: {
    title: 'Add Referrer-Policy',
    steps: [
      'Add header: Referrer-Policy: strict-origin-when-cross-origin',
      'Use no-referrer for sensitive pages if full privacy is required',
    ],
  },
  permissions_missing: {
    title: 'Add Permissions-Policy',
    steps: [
      'Restrict unused features: Permissions-Policy: camera=(), microphone=(), geolocation=()',
      'Audit which browser APIs your site actually needs',
    ],
  },
  external_scripts: {
    title: 'Review third-party scripts',
    steps: [
      'Inventory all external script sources',
      'Remove unused third-party scripts',
      'Use Subresource Integrity (SRI) for required CDN scripts',
      'Consider self-hosting critical dependencies',
    ],
  },
  third_party_dependencies: {
    title: 'Audit third-party dependencies',
    steps: [
      'Document each third-party script and its purpose',
      'Remove scripts that are no longer needed',
      'Monitor for compromised CDN packages',
    ],
  },
  login_surface: {
    title: 'Harden login surface',
    steps: [
      'Enable rate limiting and CAPTCHA on login forms',
      'Use secure, HttpOnly, SameSite cookies for sessions',
      'Implement MFA for admin accounts',
    ],
  },
  admin_endpoints: {
    title: 'Protect admin endpoints',
    steps: [
      'Restrict admin paths by IP allowlist or VPN',
      'Require strong authentication for all admin routes',
      'Remove or obfuscate admin URLs from public pages',
    ],
  },
  auth_endpoints: {
    title: 'Secure authentication endpoints',
    steps: [
      'Ensure auth routes use HTTPS only',
      'Apply rate limiting on login and token endpoints',
      'Log and monitor failed authentication attempts',
    ],
  },
  analytics_tracking: {
    title: 'Review analytics configuration',
    steps: [
      'Confirm analytics comply with privacy policy',
      'Use consent banners where required (GDPR/CCPA)',
      'Limit data collection to necessary metrics',
    ],
  },
  external_api_calls: {
    title: 'Review external API dependencies',
    steps: [
      'Inventory all external API origins called from the page',
      'Ensure API keys are not exposed in client-side code',
      'Use server-side proxies for sensitive API calls',
    ],
  },
};

/** Actionable remediation per finding — exact headers and steps. */
export function generateRecommendations(findings: SecurityFinding[]): SecurityRecommendation[] {
  return findings
    .filter((f) => RECOMMENDATION_MAP[f.id])
    .map((f) => ({
      findingId: f.id,
      title: RECOMMENDATION_MAP[f.id].title,
      steps: RECOMMENDATION_MAP[f.id].steps,
    }));
}

/** Flat string list for DB compatibility. */
export function flattenRecommendations(recommendations: SecurityRecommendation[]): string[] {
  return recommendations.flatMap((r) => [`${r.title}:`, ...r.steps.map((s) => `  - ${s}`)]);
}
