/**
 * Agency detection — parses an agency's OWN public website HTML to extract
 * non-fabricated signals about whether they manage client websites and which
 * platforms/services they offer. Reuses the lightweight fetch approach already
 * used by contactDiscovery (no new dependencies, polite UA, short timeout).
 *
 * IMPORTANT: This NEVER fabricates. Unknown => null / false / [].
 * Website technology (WordPress, WooCommerce, SEO meta) is kept separate from
 * business service evidence (web design agency, client websites, care plans).
 */

import type { AgencySignals, AgencyType } from './agencyTypes';
import { isRejectedWebsite } from '../discovery/validate';

const FETCH_UA = 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Site tech footprint — cannot classify as agency on its own. */
const WEBSITE_TECHNOLOGY_PATTERNS: { signal: string; re: RegExp }[] = [
  { signal: 'wordpress', re: /wp-content|wp-includes|\bwordpress\b/i },
  { signal: 'woocommerce', re: /\bwoocommerce\b|wc-cart/i },
  { signal: 'shopify', re: /cdn\.shopify\.com/i },
  { signal: 'webflow', re: /\bwebflow\b/i },
  { signal: 'wix', re: /\bwix\b|wixsite/i },
  { signal: 'squarespace', re: /\bsquarespace\b/i },
  { signal: 'seo_metadata', re: /<meta[^>]+name=["']description["']|og:title|twitter:card/i },
  { signal: 'third_party_scripts', re: /google-analytics|googletagmanager|facebook\.net|hotjar/i },
  { signal: 'cdn_hosting', re: /cloudflare|amazonaws|fastly|akamai|vercel|netlify/i },
  { signal: 'javascript_libs', re: /jquery|react|vue\.js|bootstrap/i },
];

/** Explicit client website service offerings — required for agency classification. */
const BUSINESS_SERVICE_PATTERNS: { service: string; re: RegExp }[] = [
  { service: 'web_design', re: /\bweb design\b|\bwebsite design\b/i },
  { service: 'web_development', re: /\bweb development\b|\bwebsite development\b/i },
  {
    service: 'wordpress_development',
    re: /wordpress (?:development|developer|agency|expert|specialist|services)/i,
  },
  {
    service: 'shopify_development',
    re: /shopify (?:development|developer|agency|partner|expert|services)/i,
  },
  { service: 'webflow_development', re: /webflow (?:development|developer|agency|expert|services)/i },
  { service: 'website_maintenance', re: /website maintenance|site maintenance|maintain (?:your|client) websites?/i },
  { service: 'care_plan', re: /care plan|website care|support plan|retainer/i },
  { service: 'managed_websites', re: /managed (?:websites?|sites?)|we manage (?:your|client) websites?|ongoing (?:website )?management/i },
  {
    service: 'client_hosting',
    re: /(?:hosting|managed hosting) (?:for|services for) (?:our )?clients?|we host (?:client|your) websites?/i,
  },
  {
    service: 'client_seo',
    re: /seo services (?:for|to) (?:our )?clients?|search engine optimization (?:for|services)/i,
  },
  {
    service: 'digital_marketing_agency',
    re: /digital marketing agency|marketing agency.*(?:web|website)/i,
  },
  { service: 'we_build_websites', re: /we build websites?|we design websites?|websites? we (?:built|designed|manage)/i },
  { service: 'client_websites', re: /client websites?|client sites?|websites? for (?:our )?clients?/i },
  { service: 'monthly_maintenance', re: /monthly maintenance|monthly (?:website )?support|monthly retainer/i },
  { service: 'portfolio_clients', re: /portfolio of client|client (?:websites?|sites?|work|projects?)/i },
  { service: 'case_studies_web', re: /case stud(?:y|ies).*(?:website|web design|web development)/i },
];

const AGENCY_TYPE_PATTERNS: { type: AgencyType; re: RegExp }[] = [
  { type: 'wordpress', re: /wordpress (?:agency|developer|expert|specialist)|wordpress development/i },
  { type: 'shopify', re: /shopify (?:agency|partner|expert|developer)/i },
  { type: 'ecommerce', re: /e-?commerce (?:agency|development|store)/i },
  { type: 'seo', re: /seo (?:agency|company|services)|search engine optimization/i },
  { type: 'marketing', re: /digital marketing (?:agency|firm)|marketing agency/i },
  { type: 'branding', re: /branding (?:agency|studio)|brand (?:agency|studio)/i },
  { type: 'creative_studio', re: /creative (?:studio|agency)|design studio/i },
  {
    type: 'web_design',
    re: /web design (?:agency|company|studio|services)|website design (?:agency|company|services)/i,
  },
  { type: 'msp', re: /managed (?:it|service|services) provider|\bmsp\b|it services/i },
  { type: 'dev_shop', re: /software (?:agency|development|house)|development shop|web app development/i },
];

const CLIENT_SITE_PATTERNS = [
  /our clients/i,
  /client (?:websites?|sites?|work|projects?)/i,
  /websites? (?:we|i) (?:built|designed|manage)/i,
  /trusted by/i,
  /brands we(?:'ve| have) worked with/i,
];

const WEB_PORTFOLIO_RE =
  /(?:web|website|digital) (?:portfolio|work|projects)|portfolio.*(?:websites?|web design)|our (?:web|website) work|case stud(?:y|ies).*(?:website|web)/i;
const GENERIC_PORTFOLIO_RE = /portfolio|our work|case stud(?:y|ies)|recent projects|featured work/i;
const TESTIMONIAL_RE = /testimonial|what our clients say|client reviews|5 ?stars?|★/i;
const PACKAGE_RE = /pricing|packages?|plans?|\$\d{2,4}\s*(?:\/|per)\s*(?:mo|month|year)|starting at \$/i;
const MAINTENANCE_RE = /care plan|website care|maintenance plan|support plan|monthly retainer|ongoing (?:support|maintenance)/i;
const HOSTING_RE = /(?:hosting|managed hosting) (?:for|services for) (?:our )?clients?|we host (?:client|your) websites?/i;
const LOCAL_RE = /local business|small business|local (?:companies|businesses)|in (?:your|our) (?:area|community)/i;
const FREELANCER_RE = /\bi['' ]?m a (?:freelance|solo)|freelancer|one-?(?:man|person)|just me\b/i;

export function hasClientWebsiteServiceEvidenceFromSignals(signals: AgencySignals): boolean {
  return signals.hasClientWebsiteServiceEvidence;
}

export function detectAgencySignalsFromHtml(html: string): AgencySignals {
  const text = html.toLowerCase();

  const websiteTechnologySignals = WEBSITE_TECHNOLOGY_PATTERNS.filter((p) => p.re.test(html)).map(
    (p) => p.signal,
  );
  const businessServiceSignals = BUSINESS_SERVICE_PATTERNS.filter((p) => p.re.test(html)).map(
    (p) => p.service,
  );

  const hasClientWebsiteServiceEvidence = businessServiceSignals.length >= 1;

  const clientSiteHits = hasClientWebsiteServiceEvidence
    ? CLIENT_SITE_PATTERNS.filter((re) => re.test(html)).length
    : 0;
  const hasPortfolio = hasClientWebsiteServiceEvidence
    ? WEB_PORTFOLIO_RE.test(html) ||
      (GENERIC_PORTFOLIO_RE.test(html) && businessServiceSignals.length >= 1)
    : false;
  const hasTestimonials = TESTIMONIAL_RE.test(html);
  const hasServicePackages =
    hasClientWebsiteServiceEvidence &&
    PACKAGE_RE.test(html) &&
    /\b(?:web|website|design|development|maintenance|hosting|seo)\b/i.test(html);
  const mentionsMaintenanceOrCarePlans =
    hasClientWebsiteServiceEvidence && MAINTENANCE_RE.test(html);
  const mentionsHosting = hasClientWebsiteServiceEvidence && HOSTING_RE.test(html);
  const servesLocalBusinesses =
    hasClientWebsiteServiceEvidence && LOCAL_RE.test(html);
  const publicContactEmail = EMAIL_RE.test(html) || /mailto:/i.test(html);
  const freelancerOnly =
    hasClientWebsiteServiceEvidence &&
    FREELANCER_RE.test(html) &&
    !/\bour team\b|\bwe are a team\b/i.test(html);

  let managesClientSites: boolean | null = null;
  if (!hasClientWebsiteServiceEvidence) {
    managesClientSites =
      websiteTechnologySignals.length > 0 ||
      GENERIC_PORTFOLIO_RE.test(html) ||
      /\bweb\b|\bwebsite\b|\bdesign\b|\bdevelop/i.test(text)
        ? false
        : null;
  } else if (clientSiteHits >= 1 || hasPortfolio || mentionsMaintenanceOrCarePlans) {
    managesClientSites = true;
  } else {
    managesClientSites = true;
  }

  let estimatedSiteCount: number | null = null;
  if (hasClientWebsiteServiceEvidence && (hasPortfolio || clientSiteHits >= 1)) {
    const portfolioMatches = (html.match(/case stud(?:y|ies)|portfolio-item|project-card|work-item/gi) ?? [])
      .length;
    const plusMatch = html.match(/(\d{2,4})\s*\+?\s*(?:clients?|projects?|websites?|sites?)/i);
    if (plusMatch) {
      estimatedSiteCount = Math.min(2000, parseInt(plusMatch[1], 10));
    } else if (portfolioMatches > 0) {
      estimatedSiteCount = Math.min(500, portfolioMatches);
    }
  }

  const ownSiteSecuritySignals =
    /http:\/\//i.test(html) && !/https:\/\//i.test(html)
      ? true
      : /copyright\s*©?\s*20(1[0-9]|2[0-3])/i.test(html);

  return {
    websiteTechnologySignals,
    businessServiceSignals,
    hasClientWebsiteServiceEvidence,
    detectedServices: businessServiceSignals,
    managesClientSites,
    hasPortfolio,
    hasTestimonials,
    hasServicePackages,
    mentionsMaintenanceOrCarePlans,
    mentionsHosting,
    servesLocalBusinesses,
    publicContactEmail,
    freelancerOnly,
    estimatedSiteCount,
    ownSiteSecuritySignals,
  };
}

export function inferAgencyTypeFromHtml(
  html: string,
  fallback: AgencyType = 'unknown',
): AgencyType {
  const signals = detectAgencySignalsFromHtml(html);
  if (!signals.hasClientWebsiteServiceEvidence) return 'unknown';

  for (const { type, re } of AGENCY_TYPE_PATTERNS) {
    if (re.test(html)) return type;
  }
  if (signals.businessServiceSignals.includes('web_design')) return 'web_design';
  if (signals.businessServiceSignals.includes('web_development')) return 'web_design';
  return fallback;
}

export function emptyAgencySignals(): AgencySignals {
  return {
    websiteTechnologySignals: [],
    businessServiceSignals: [],
    hasClientWebsiteServiceEvidence: false,
    detectedServices: [],
    managesClientSites: null,
    hasPortfolio: false,
    hasTestimonials: false,
    hasServicePackages: false,
    mentionsMaintenanceOrCarePlans: false,
    mentionsHosting: false,
    servesLocalBusinesses: false,
    publicContactEmail: false,
    freelancerOnly: false,
    estimatedSiteCount: null,
    ownSiteSecuritySignals: false,
  };
}

/** Fetch the agency's home page (and best-effort services page) and detect signals. */
export async function fetchAgencySignals(
  website: string,
): Promise<{ signals: AgencySignals; agencyType: AgencyType }> {
  let url = website.trim();
  if (!url.startsWith('http')) url = `https://${url}`;

  if (isRejectedWebsite(url)) {
    return { signals: emptyAgencySignals(), agencyType: 'unknown' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': FETCH_UA },
    });
    if (!res.ok) return { signals: emptyAgencySignals(), agencyType: 'unknown' };

    let html = (await res.text()).slice(0, 200_000);

    for (const path of ['/services', '/work', '/portfolio']) {
      if (html.length > 160_000) break;
      try {
        const pageUrl = new URL(path, res.url || url).toString();
        const pageRes = await fetch(pageUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': FETCH_UA },
        });
        if (pageRes.ok) {
          html += '\n' + (await pageRes.text()).slice(0, 60_000);
        }
      } catch {
        /* optional page */
      }
    }

    const signals = detectAgencySignalsFromHtml(html);
    const agencyType = inferAgencyTypeFromHtml(html);
    return { signals, agencyType };
  } catch {
    return { signals: emptyAgencySignals(), agencyType: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}
