import { EXPLOIT_RULES } from '@/lib/securityIntelligence/exploitContext';
import type { FindingCategory, Severity } from '@/lib/securityIntelligence/types';
import { assertSafeCopy } from './bannedLanguage';
import type { FindingExplainer, FixDifficulty, UrgencyLevel } from './types';

type CatalogEntry = Omit<FindingExplainer, 'id' | 'title' | 'severity' | 'category'> & {
  title: string;
  severity: Severity;
  category: FindingCategory;
};

const HEADER_IDS = [
  'csp_missing',
  'hsts_missing',
  'referrer_missing',
  'permissions_missing',
  'xcontenttype_missing',
  'xframe_missing',
] as const;

function buildDeveloperMessage(title: string, technical: string, step: string): string {
  return [
    `Hi — CyberShield flagged "${title}" on our website during monitoring.`,
    '',
    'What we need:',
    step,
    '',
    'Technical context:',
    technical,
    '',
    'Please confirm when this is updated so we can re-scan.',
    'Thanks',
  ].join('\n');
}

function fromExploitRule(
  id: string,
  title: string,
  overrides: Partial<CatalogEntry> = {},
): FindingExplainer {
  const rule = EXPLOIT_RULES[id];
  if (!rule) {
    throw new Error(`Missing exploit rule for ${id}`);
  }

  const plainEnglish =
    overrides.plainEnglish ??
    (rule.category === 'headers'
      ? `Your site is missing ${title.replace(/^Missing /i, '').replace(/^No /i, '')} — a standard browser protection that helps keep visitors safe.`
      : rule.impact[0] ?? 'This item should be reviewed with your developer or host.');
  const businessImpact =
    overrides.businessImpact ?? rule.impact[0] ?? 'This gap can reduce customer trust over time.';
  const technicalExplanation = overrides.technicalExplanation ?? rule.exploitScenario;
  const recommendedNextStep = overrides.recommendedNextStep ?? rule.fix;
  const developerMessage =
    overrides.developerMessage ??
    buildDeveloperMessage(title, rule.fix, recommendedNextStep);
  const ownerAction =
    overrides.ownerAction ??
    'Share this with whoever manages your website hosting or CMS — most fixes are a one-time configuration change.';
  const urgency: UrgencyLevel =
    overrides.urgency ??
    (rule.severity === 'critical' ? 'immediate' : rule.severity === 'high' ? 'soon' : 'planned');
  const difficulty: FixDifficulty =
    overrides.difficulty ??
    (id.includes('ssl') || id === 'hsts_missing' ? 'medium' : 'easy');

  const explainer: FindingExplainer = {
    id,
    title,
    severity: rule.severity,
    category: rule.category,
    plainEnglish,
    businessImpact,
    technicalExplanation,
    recommendedNextStep,
    developerMessage,
    ownerAction,
    urgency,
    difficulty,
  };

  assertSafeCopy(
    [plainEnglish, businessImpact, technicalExplanation, developerMessage].join(' '),
    `catalog:${id}`,
  );
  return explainer;
}

/** Operational / monitoring issues (not always in EXPLOIT_RULES). */
const OPERATIONAL_CATALOG: Record<string, CatalogEntry> = {
  ssl_expiring: {
    title: 'SSL certificate expiring soon',
    severity: 'high',
    category: 'transport',
    plainEnglish:
      'Your HTTPS certificate is nearing its expiry date. Browsers will start showing security warnings if it lapses.',
    businessImpact:
      'Visitors may see “Not Secure” warnings, which hurts trust and can interrupt checkout or form submissions.',
    technicalExplanation:
      'TLS certificates have a fixed validity period. After expiry, browsers cannot verify your server identity.',
    recommendedNextStep:
      'Renew the certificate with your hosting provider or certificate authority before the expiry date.',
    developerMessage: buildDeveloperMessage(
      'SSL certificate expiring soon',
      'Certificate renewal required before browser trust warnings appear.',
      'Please renew the TLS certificate and confirm auto-renewal is enabled.',
    ),
    ownerAction: 'Check your hosting dashboard or ask your web partner to confirm renewal is scheduled.',
    urgency: 'soon',
    difficulty: 'easy',
  },
  ssl_expired: {
    title: 'SSL certificate expired',
    severity: 'critical',
    category: 'transport',
    plainEnglish:
      'Your HTTPS certificate has expired. Visitors may see browser warnings when they visit your site.',
    businessImpact:
      'Security warnings reduce conversions and signal neglect to customers and search engines.',
    technicalExplanation: 'An expired certificate breaks the chain of trust between browser and server.',
    recommendedNextStep: 'Install a renewed certificate immediately and verify HTTPS works on all pages.',
    developerMessage: buildDeveloperMessage(
      'SSL certificate expired',
      'Browsers are showing trust warnings to visitors.',
      'Please install a valid TLS certificate today and force HTTPS redirects.',
    ),
    ownerAction: 'Treat this as urgent — contact hosting support or your web developer today.',
    urgency: 'immediate',
    difficulty: 'medium',
  },
  domain_expiring: {
    title: 'Domain registration expiring soon',
    severity: 'high',
    category: 'transport',
    plainEnglish:
      'Your domain name registration is close to expiring. If it lapses, your website and email can go offline.',
    businessImpact:
      'Losing a domain can take your site offline and allow someone else to register it after the grace period.',
    technicalExplanation:
      'Domain registrations are leased. Expiry removes DNS resolution for your website and mail records.',
    recommendedNextStep: 'Log in to your domain registrar and renew for at least one year. Enable auto-renew if available.',
    developerMessage: buildDeveloperMessage(
      'Domain registration expiring soon',
      'DNS will stop resolving if the domain is not renewed.',
      'Please confirm domain auto-renewal is enabled at the registrar.',
    ),
    ownerAction: 'Renew at your registrar (GoDaddy, Namecheap, Cloudflare, etc.) — takes a few minutes.',
    urgency: 'soon',
    difficulty: 'easy',
  },
  website_unreachable: {
    title: 'Website unreachable',
    severity: 'critical',
    category: 'transport',
    plainEnglish:
      'CyberShield could not reach your website during the last check. It may be down or blocking our monitor.',
    businessImpact:
      'If customers cannot load your site, you lose leads, sales, and credibility until it is back online.',
    technicalExplanation:
      'HTTP requests failed or timed out — hosting outage, DNS misconfiguration, or firewall block are common causes.',
    recommendedNextStep:
      'Check hosting status, DNS records, and any recent deployments. Confirm the site loads in a private browser window.',
    developerMessage: buildDeveloperMessage(
      'Website unreachable',
      'External uptime checks are failing.',
      'Please investigate hosting/DNS/firewall and confirm the site responds with HTTP 200.',
    ),
    ownerAction: 'Check your hosting provider status page first, then contact support if the site is down for you too.',
    urgency: 'immediate',
    difficulty: 'medium',
  },
  uptime_issue: {
    title: 'Uptime or availability issue',
    severity: 'high',
    category: 'transport',
    plainEnglish:
      'Your site responded slowly or with errors during recent checks — visitors may be seeing intermittent problems.',
    businessImpact:
      'Slow or flaky sites lose search ranking and frustrate customers trying to book, buy, or contact you.',
    technicalExplanation:
      'Elevated response times or non-200 status codes indicate server load, misconfiguration, or upstream dependency failure.',
    recommendedNextStep:
      'Review server logs and recent changes. Confirm CDN, database, and payment plugins are healthy.',
    developerMessage: buildDeveloperMessage(
      'Uptime or availability issue',
      'Monitoring detected slow responses or error status codes.',
      'Please review server logs and recent deployments for the root cause.',
    ),
    ownerAction: 'Ask your host or developer if there were recent updates or traffic spikes.',
    urgency: 'soon',
    difficulty: 'medium',
  },
  unexpected_website_change: {
    title: 'Unexpected website change detected',
    severity: 'high',
    category: 'attack_surface',
    plainEnglish:
      'Something on your website changed since the last scan — content, scripts, or configuration shifted without a matching alert from your team.',
    businessImpact:
      'Unplanned changes can break forms, introduce bad scripts, or signal unauthorized edits.',
    technicalExplanation:
      'Change detection compares page hash, headers, or scripts against the previous known-good snapshot.',
    recommendedNextStep:
      'Review recent CMS edits, plugin updates, and agency changes. Roll back if the change was not authorized.',
    developerMessage: buildDeveloperMessage(
      'Unexpected website change detected',
      'Monitoring detected a diff from the prior baseline scan.',
      'Please confirm whether this change was intentional and document the deployment.',
    ),
    ownerAction: 'Check with your team: was a plugin updated or content published today?',
    urgency: 'soon',
    difficulty: 'medium',
  },
  changed_scripts: {
    title: 'Third-party scripts changed',
    severity: 'medium',
    category: 'third_party',
    plainEnglish:
      'JavaScript files loaded on your site changed since the last scan — often from a plugin, tag manager, or CDN update.',
    businessImpact:
      'New or altered scripts can affect page speed, tracking, checkout flows, or introduce supply-chain risk.',
    technicalExplanation:
      'Script URLs or inline script hashes differ from the previous monitoring baseline.',
    recommendedNextStep:
      'Inventory which scripts changed and confirm they match an approved update from your developer or marketing tools.',
    developerMessage: buildDeveloperMessage(
      'Third-party scripts changed',
      'External or inline script references differ from the prior scan.',
      'Please confirm the script changes were intentional and document the vendor update.',
    ),
    ownerAction: 'Ask whether marketing or your developer pushed a tag manager or analytics update.',
    urgency: 'planned',
    difficulty: 'medium',
  },
  changed_headers: {
    title: 'Security headers changed',
    severity: 'high',
    category: 'headers',
    plainEnglish:
      'Browser security headers on your site changed since the last scan — a protection may have been removed or weakened.',
    businessImpact:
      'Weakened headers reduce defense against clickjacking, data leakage, and script injection.',
    technicalExplanation:
      'Response headers such as CSP, HSTS, or X-Frame-Options differ from the previous baseline.',
    recommendedNextStep:
      'Compare current headers with the prior scan and restore any protections that were removed unintentionally.',
    developerMessage: buildDeveloperMessage(
      'Security headers changed',
      'HTTP security headers differ from the last known-good configuration.',
      'Please review recent server or CDN config changes and restore removed protections.',
    ),
    ownerAction: 'Flag this to your developer — header changes often follow hosting or CDN updates.',
    urgency: 'soon',
    difficulty: 'easy',
  },
  mixed_content: {
    title: 'Mixed content detected',
    severity: 'medium',
    category: 'transport',
    plainEnglish:
      'Your HTTPS page loads some resources over plain HTTP. Browsers may block them or show security warnings.',
    businessImpact:
      'Broken images, scripts, or checkout widgets hurt user experience and trust.',
    technicalExplanation:
      'Active or passive mixed content occurs when subresources use http:// on an https:// page.',
    recommendedNextStep:
      'Update asset URLs to https:// or use protocol-relative paths. Fix hard-coded http links in CMS content.',
    developerMessage: buildDeveloperMessage(
      'Mixed content detected',
      'Some subresources are still loaded over HTTP on HTTPS pages.',
      'Please update asset URLs to HTTPS and re-test in browser dev tools.',
    ),
    ownerAction: 'Share this with your developer — usually a quick URL update in the CMS or theme.',
    urgency: 'planned',
    difficulty: 'easy',
  },
};

const CARD_TITLES: Record<string, string> = {
  csp_missing: 'Missing Content-Security-Policy',
  hsts_missing: 'Missing Strict-Transport-Security',
  referrer_missing: 'Missing Referrer-Policy',
  permissions_missing: 'Missing Permissions-Policy',
  xcontenttype_missing: 'Missing X-Content-Type-Options',
  xframe_missing: 'Missing X-Frame-Options',
  ssl_missing: 'No HTTPS / TLS encryption',
  login_surface: 'Login form exposed',
  admin_endpoints: 'Admin or login path detected',
  auth_endpoints: 'Authentication endpoints visible',
  external_scripts: 'Third-party scripts detected',
  third_party_dependencies: 'Third-party dependencies detected',
  external_api_calls: 'External API calls from page',
  analytics_tracking: 'Third-party analytics detected',
};

const EXPLOIT_EXPLAINER_OVERRIDES: Record<string, Partial<CatalogEntry>> = {
  external_scripts: {
    plainEnglish:
      'Your site loads scripts from outside services. This is common, but each script is a dependency that should be reviewed regularly.',
    businessImpact:
      'External scripts are common, but each one adds a vendor dependency. If a provider changes, breaks, or is compromised, it can affect customer trust, functionality, performance, or security.',
  },
  third_party_dependencies: {
    plainEnglish:
      'Your site relies on known third-party libraries or services. Each dependency adds monitoring and update obligations.',
    businessImpact:
      'Vendor updates, outages, or security advisories can affect how your site behaves for customers.',
  },
  auth_endpoints: {
    plainEnglish:
      'CyberShield detected a login or authentication-related route. This is normal for many websites, but these routes should have rate limiting, secure cookies, and abuse monitoring.',
    businessImpact:
      'Login routes are high-trust surfaces. Weak protections can affect account safety and brand confidence.',
  },
  login_surface: {
    plainEnglish:
      'A login or account form is reachable from the scanned page. Confirm brute-force protection and secure session handling are in place.',
    businessImpact:
      'Customer login pages need HTTPS, rate limiting, and secure cookies — not necessarily signs of an active breach.',
  },
  admin_endpoints: {
    plainEnglish:
      'Administrative URL paths appear in your public page scan. Restrict access and require strong authentication.',
    businessImpact:
      'Discoverable admin paths are not a confirmed breach, but they can make unwanted probing easier if protections are weak.',
  },
  external_api_calls: {
    plainEnglish:
      'CyberShield detected external API or service connections from the page. These should be reviewed to confirm that no private keys, tokens, or sensitive endpoints are exposed client-side.',
    businessImpact:
      'External connections are often required for product features, but secrets must stay server-side and vendors should stay trusted.',
  },
  analytics_tracking: {
    plainEnglish:
      'Analytics or tracking scripts are active on your site. Confirm they match your privacy policy and performance expectations.',
    businessImpact:
      'Tracking helps marketing, but misconfigured tags can leak data or slow page load times.',
  },
};

function operationalExplainer(id: string): FindingExplainer {
  const entry = OPERATIONAL_CATALOG[id];
  if (!entry) throw new Error(`Unknown operational finding ${id}`);
  const explainer: FindingExplainer = { id, ...entry };
  assertSafeCopy(
    [explainer.plainEnglish, explainer.businessImpact, explainer.developerMessage].join(' '),
    `operational:${id}`,
  );
  return explainer;
}

/** All catalog IDs that must exist for verification. */
export const REQUIRED_EXPLAINER_IDS = [
  ...HEADER_IDS,
  'ssl_expiring',
  'ssl_expired',
  'domain_expiring',
  'website_unreachable',
  'uptime_issue',
  'unexpected_website_change',
  'changed_scripts',
  'changed_headers',
  'mixed_content',
  'admin_endpoints',
] as const;

let _cache: Map<string, FindingExplainer> | null = null;

function buildCatalog(): Map<string, FindingExplainer> {
  const map = new Map<string, FindingExplainer>();

  for (const id of Object.keys(CARD_TITLES)) {
    const title = CARD_TITLES[id]!;
    const overrides = EXPLOIT_EXPLAINER_OVERRIDES[id] ?? {};
    map.set(id, fromExploitRule(id, title, overrides));
  }

  for (const id of Object.keys(OPERATIONAL_CATALOG)) {
    map.set(id, operationalExplainer(id));
  }

  return map;
}

export function getFindingExplainer(findingId: string): FindingExplainer | null {
  if (!_cache) _cache = buildCatalog();
  const normalized = findingId.toLowerCase().replace(/\s+/g, '_');
  return _cache.get(normalized) ?? matchExplainerFromText(findingId);
}

/** Match raw scanner issue strings to catalog entries. */
export function matchExplainerFromText(text: string): FindingExplainer | null {
  if (!_cache) _cache = buildCatalog();
  const lower = text.toLowerCase();

  if (/content-security-policy|csp/.test(lower)) return _cache.get('csp_missing') ?? null;
  if (/strict-transport|hsts/.test(lower)) return _cache.get('hsts_missing') ?? null;
  if (/referrer-policy/.test(lower)) return _cache.get('referrer_missing') ?? null;
  if (/permissions-policy/.test(lower)) return _cache.get('permissions_missing') ?? null;
  if (/x-content-type|nosniff/.test(lower)) return _cache.get('xcontenttype_missing') ?? null;
  if (/x-frame|clickjack/.test(lower)) return _cache.get('xframe_missing') ?? null;
  if (/ssl.*expir|certificate.*expir|cert.*expir/.test(lower)) {
    return /expired|past due/.test(lower)
      ? (_cache.get('ssl_expired') ?? null)
      : (_cache.get('ssl_expiring') ?? null);
  }
  if (/domain.*expir/.test(lower)) return _cache.get('domain_expiring') ?? null;
  if (/unreachable|down|not responding|connection refused/.test(lower))
    return _cache.get('website_unreachable') ?? null;
  if (/uptime|availability|slow response/.test(lower)) return _cache.get('uptime_issue') ?? null;
  if (/unexpected change|site change|page change/.test(lower))
    return _cache.get('unexpected_website_change') ?? null;
  if (/script.*change|changed script/.test(lower)) return _cache.get('changed_scripts') ?? null;
  if (/header.*change|changed header/.test(lower)) return _cache.get('changed_headers') ?? null;
  if (/mixed content/.test(lower)) return _cache.get('mixed_content') ?? null;
  if (/admin|wp-admin|login path/.test(lower)) return _cache.get('admin_endpoints') ?? null;

  return null;
}

export function listAllExplainers(): FindingExplainer[] {
  if (!_cache) _cache = buildCatalog();
  return Array.from(_cache.values());
}

export function explainerForSecurityFinding(finding: {
  id: string;
  title: string;
  description: string;
  impact: string[];
  exploitScenario: string;
  fix: string;
  severity: Severity;
  category: FindingCategory;
}): FindingExplainer {
  const fromCatalog = getFindingExplainer(finding.id);
  if (fromCatalog) return fromCatalog;

  const fallback: FindingExplainer = {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    plainEnglish: finding.description,
    businessImpact: finding.impact[0] ?? 'Addressing this reduces avoidable risk to your business.',
    technicalExplanation: finding.exploitScenario,
    recommendedNextStep: finding.fix,
    developerMessage: buildDeveloperMessage(finding.title, finding.fix, finding.fix),
    ownerAction: 'Share this finding with whoever maintains your website.',
    urgency: finding.severity === 'critical' ? 'immediate' : finding.severity === 'high' ? 'soon' : 'planned',
    difficulty: 'medium',
  };
  assertSafeCopy(
    [fallback.plainEnglish, fallback.businessImpact, fallback.developerMessage].join(' '),
    `fallback:${finding.id}`,
  );
  return fallback;
}
