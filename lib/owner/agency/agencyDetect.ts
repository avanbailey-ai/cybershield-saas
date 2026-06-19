/**
 * Agency detection — parses an agency's OWN public website HTML to extract
 * non-fabricated signals about whether they manage client websites and which
 * platforms/services they offer. Reuses the lightweight fetch approach already
 * used by contactDiscovery (no new dependencies, polite UA, short timeout).
 *
 * IMPORTANT: This NEVER fabricates. Unknown => null / false / [].
 */

import type { AgencySignals, AgencyType } from './agencyTypes';
import { isRejectedWebsite } from '../discovery/validate';

const FETCH_UA = 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const SERVICE_PATTERNS: { service: string; re: RegExp }[] = [
  { service: 'wordpress', re: /\bwordpress\b|wp-content|wp-includes/i },
  { service: 'shopify', re: /\bshopify\b|cdn\.shopify\.com/i },
  { service: 'webflow', re: /\bwebflow\b/i },
  { service: 'wix', re: /\bwix\b|wixsite/i },
  { service: 'squarespace', re: /\bsquarespace\b/i },
  { service: 'woocommerce', re: /\bwoocommerce\b/i },
  { service: 'seo', re: /\bseo\b|search engine optimization/i },
  { service: 'hosting', re: /\bhosting\b|managed hosting|web hosting/i },
  { service: 'maintenance', re: /\bmaintenance\b|website maintenance|site maintenance/i },
  { service: 'care_plan', re: /care plan|website care|support plan|retainer/i },
  { service: 'security', re: /\bsecurity\b|malware|firewall|ssl/i },
  { service: 'managed_sites', re: /managed (?:websites?|sites?)|we manage|ongoing management/i },
  { service: 'digital_marketing', re: /digital marketing|ppc|google ads|social media marketing/i },
  { service: 'branding', re: /\bbranding\b|brand identity|logo design/i },
  { service: 'ecommerce', re: /\be-?commerce\b|online store|online shop/i },
];

const AGENCY_TYPE_PATTERNS: { type: AgencyType; re: RegExp }[] = [
  { type: 'wordpress', re: /wordpress (?:agency|developer|expert|specialist)|wordpress development/i },
  { type: 'shopify', re: /shopify (?:agency|partner|expert|developer)/i },
  { type: 'ecommerce', re: /e-?commerce (?:agency|development|store)/i },
  { type: 'seo', re: /seo (?:agency|company|services)|search engine optimization/i },
  { type: 'marketing', re: /digital marketing (?:agency|firm)|marketing agency/i },
  { type: 'branding', re: /branding (?:agency|studio)|brand (?:agency|studio)/i },
  { type: 'creative_studio', re: /creative (?:studio|agency)|design studio/i },
  { type: 'web_design', re: /web design|website design|web development (?:agency|company)|web design (?:agency|company)/i },
  { type: 'msp', re: /managed (?:it|service|services) provider|\bmsp\b|it services/i },
  { type: 'dev_shop', re: /software (?:agency|development|house)|development shop|web app development/i },
];

const CLIENT_SITE_PATTERNS = [
  /our clients/i,
  /client (?:websites?|sites?|work|projects?)/i,
  /portfolio/i,
  /case stud(?:y|ies)/i,
  /websites? (?:we|i) (?:built|designed|manage)/i,
  /trusted by/i,
  /brands we(?:'ve| have) worked with/i,
];

const PORTFOLIO_RE = /portfolio|our work|case stud(?:y|ies)|recent projects|featured work/i;
const TESTIMONIAL_RE = /testimonial|what our clients say|client reviews|5 ?stars?|★/i;
const PACKAGE_RE = /pricing|packages?|plans?|\$\d{2,4}\s*(?:\/|per)\s*(?:mo|month|year)|starting at \$/i;
const MAINTENANCE_RE = /care plan|website care|maintenance plan|support plan|monthly retainer|ongoing (?:support|maintenance)/i;
const HOSTING_RE = /\bhosting\b|managed hosting|we host/i;
const LOCAL_RE = /local business|small business|local (?:companies|businesses)|in (?:your|our) (?:area|community)/i;
const FREELANCER_RE = /\bi['' ]?m a (?:freelance|solo)|freelancer|one-?(?:man|person)|just me\b/i;

export function detectAgencySignalsFromHtml(html: string): AgencySignals {
  const text = html.toLowerCase();

  const detectedServices = SERVICE_PATTERNS.filter((p) => p.re.test(html)).map((p) => p.service);

  const clientSiteHits = CLIENT_SITE_PATTERNS.filter((re) => re.test(html)).length;
  const hasPortfolio = PORTFOLIO_RE.test(html);
  const hasTestimonials = TESTIMONIAL_RE.test(html);
  const hasServicePackages = PACKAGE_RE.test(html);
  const mentionsMaintenanceOrCarePlans = MAINTENANCE_RE.test(html);
  const mentionsHosting = HOSTING_RE.test(html);
  const servesLocalBusinesses = LOCAL_RE.test(html);
  const publicContactEmail = EMAIL_RE.test(html) || /mailto:/i.test(html);
  const freelancerOnly = FREELANCER_RE.test(html) && !/\bour team\b|\bwe are a team\b/i.test(html);

  // managesClientSites: strong evidence -> true; clear absence of any web work -> false; otherwise null
  let managesClientSites: boolean | null = null;
  if (clientSiteHits >= 1 || hasPortfolio || mentionsMaintenanceOrCarePlans) {
    managesClientSites = true;
  } else if (
    detectedServices.length === 0 &&
    !/\bweb\b|\bwebsite\b|\bdesign\b|\bdevelop/i.test(text)
  ) {
    managesClientSites = false;
  }

  // estimatedSiteCount: count distinct portfolio/case-study style references. null when no proof.
  let estimatedSiteCount: number | null = null;
  if (hasPortfolio || clientSiteHits >= 1) {
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
    /http:\/\//i.test(html) && !/https:\/\//i.test(html) ? true : /copyright\s*©?\s*20(1[0-9]|2[0-3])/i.test(html);

  return {
    detectedServices,
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
  for (const { type, re } of AGENCY_TYPE_PATTERNS) {
    if (re.test(html)) return type;
  }
  return fallback;
}

export function emptyAgencySignals(): AgencySignals {
  return {
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

  // Never fetch example/localhost/test hosts — mirror the discovery guard so we
  // don't hit junk hosts during agency signal detection.
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

    // Best-effort: pull a services/about page for richer signals.
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
