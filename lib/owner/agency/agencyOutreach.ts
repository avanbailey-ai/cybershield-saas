/**
 * Agency outreach generator (Founder OS, owner-only).
 *
 * This is a SEPARATE generator from lib/owner/generators/outreach.ts. It is
 * deliberately NOT scanner-findings-first. It leads with the AGENCY's business
 * (they build/manage client websites), explains CyberShield Cloud as client-site
 * monitoring + reporting infrastructure, includes 2-3 observations about their
 * own site/services, mentions the Agency plan / multi-site monitoring, and ends
 * with a tracked, low-pressure CTA.
 *
 * Tone: professional, founder-to-agency-owner, partnership-oriented. NOT
 * fear-based, NOT spammy, NOT overly technical in the opening. No fake claims,
 * no "your clients are at risk", no partnership claims.
 *
 * Output always begins with "Subject: " so the existing parseDraftContent in
 * outreachExecution.ts works unchanged. The unsubscribe footer + (when no link
 * is embedded) the tracked attribution link are added by the send pipeline.
 */

import type { AgencyType } from './agencyTypes';
import { AGENCY_PLAN_PRICE } from './agencyScore';

const AGENCY_DESCRIPTORS: Record<AgencyType, string> = {
  web_design: 'as a web design agency',
  wordpress: 'as a WordPress agency',
  shopify: 'as a Shopify agency',
  ecommerce: 'as an ecommerce agency',
  seo: 'as an SEO agency',
  marketing: 'as a digital marketing agency',
  branding: 'as a branding studio',
  creative_studio: 'as a creative studio',
  msp: 'as a managed service provider',
  dev_shop: 'as a development studio',
  unknown: 'as a team that builds and manages websites',
};

export interface AgencyOutreachInput {
  agencyName: string;
  website: string;
  contactName?: string | null;
  agencyType?: AgencyType | null;
  detectedServices?: string[] | null;
  estimatedSiteCount?: number | null;
  managesClientSites?: boolean | null;
  city?: string | null;
  /** Tracked CTA link. When omitted, the send pipeline appends the tracked link. */
  signupUrl?: string | null;
}

/**
 * Core agency value message (spec). Exported so it can be asserted by the
 * verification script and reused elsewhere without drift.
 */
export const AGENCY_VALUE_PROP =
  'CyberShield Cloud helps agencies monitor client websites for SSL issues, domain problems, security configuration changes, uptime changes, and unexpected website changes — so agencies can catch problems early and give clients better reporting.';

/** Plain explanation of what the product gives an agency (monitoring + reporting). */
export const AGENCY_MONITORING_EXPLANATION =
  'It works as monitoring and reporting infrastructure for the sites you manage: continuous checks on SSL, domains, security configuration, uptime, and unexpected changes, with monthly client-ready reports you can put your name on.';

/** Natural mention of the Agency plan / multi-site monitoring. */
export const AGENCY_PLAN_MENTION =
  `Most agencies run this on our Agency plan ($${AGENCY_PLAN_PRICE}/mo), which is built for monitoring multiple client sites from one dashboard — an easy add-on to existing care or maintenance plans.`;

function greeting(contactName?: string | null): string {
  return `Hi${contactName ? ` ${contactName}` : ''},`;
}

function agencyDescriptor(input: AgencyOutreachInput): string {
  const type = (input.agencyType ?? 'unknown') as AgencyType;
  return AGENCY_DESCRIPTORS[type] ?? AGENCY_DESCRIPTORS.unknown;
}

/**
 * 2-3 light, factual observations about the agency's own site/services. These
 * are about THEIR business (services, platforms, client work) — never raw
 * scanner severity findings.
 */
function buildObservations(input: AgencyOutreachInput): string[] {
  const observations: string[] = [];
  const services = input.detectedServices ?? [];

  const platformLabels: Record<string, string> = {
    wordpress: 'WordPress',
    shopify: 'Shopify',
    webflow: 'Webflow',
    wix: 'Wix',
    squarespace: 'Squarespace',
    woocommerce: 'WooCommerce',
  };
  const platforms = services.map((s) => platformLabels[s]).filter(Boolean);
  if (platforms.length) {
    observations.push(
      `I saw you build on ${platforms.join(' and ')} — those client sites tend to drift after launch as plugins, themes, and certificates change.`,
    );
  }

  if (services.includes('care_plan') || services.includes('maintenance')) {
    observations.push(
      'Since you already offer care/maintenance plans, monitoring slots in as proof-of-work your clients can actually see each month.',
    );
  } else if (services.includes('hosting')) {
    observations.push(
      'Because you handle hosting, you are usually first to hear when something breaks — monitoring lets you get ahead of those calls.',
    );
  }

  if (input.estimatedSiteCount && input.estimatedSiteCount >= 5) {
    observations.push(
      `With around ${input.estimatedSiteCount} client sites in your portfolio, watching them all manually is tough — that is exactly the gap this fills.`,
    );
  } else if (input.managesClientSites === true && observations.length < 2) {
    observations.push(
      'Since you manage sites on behalf of clients, you carry the risk when one quietly goes down or a certificate lapses — monitoring takes that off your plate.',
    );
  }

  if (services.includes('seo') && observations.length < 3) {
    observations.push(
      'On the SEO side, uptime and SSL changes quietly hurt rankings, so catching them early protects the results you report on.',
    );
  }

  if (observations.length === 0) {
    observations.push(
      `Looking at ${input.website}, it is clear you work on real business websites — which is exactly the kind of work that benefits from monitoring after launch.`,
    );
  }

  return observations.slice(0, 3);
}

function ctaLine(input: AgencyOutreachInput): string {
  if (input.signupUrl) {
    return `If it is useful, here is a quick overview of how agencies use it: ${input.signupUrl}`;
  }
  // No token yet — the send pipeline appends the tracked Agency signup link.
  return 'If it is useful, I can send a quick overview of how agencies use it — just reply and I will share the link.';
}

/**
 * Generate the full agency outreach email. 9-part structure:
 *  1. personalized reason for reaching out
 *  2. acknowledge they manage/build client sites
 *  3. agency-specific business value
 *  4. CyberShield Cloud as monitoring/reporting infrastructure
 *  5. 2-3 relevant observations about their site/services
 *  6. mention Agency plan / multi-site monitoring naturally
 *  7. tracked CTA link
 *  8. low-pressure CTA
 *  9. footer (unsubscribe handled by the send pipeline)
 */
export function generateAgencyOutreach(input: AgencyOutreachInput): string {
  const subject = `Quick idea for ${input.agencyName}'s client website care plans`;
  const observations = buildObservations(input);

  const body = [
    greeting(input.contactName),
    '',
    // 1 + 2: personalized reason + acknowledge they manage/build client sites
    `I'm reaching out because ${input.agencyName} works with business websites ${agencyDescriptor(
      input,
    )}, and CyberShield Cloud is built for teams that need to keep client sites healthy after launch.`,
    '',
    // 3: agency-specific business value (recurring revenue, fewer emergencies, better reporting)
    `${AGENCY_VALUE_PROP} For an agency, that usually means fewer client emergencies, catching problems before clients notice, and a recurring add-on that strengthens your maintenance offering.`,
    '',
    // 4: CyberShield Cloud as monitoring / reporting infrastructure
    AGENCY_MONITORING_EXPLANATION,
    '',
    // 5: 2-3 relevant observations about their site / services
    observations.join(' '),
    '',
    // 6: Agency plan / multi-site monitoring
    AGENCY_PLAN_MENTION,
    '',
    // 7: tracked CTA link
    ctaLine(input),
    '',
    // 8: low-pressure CTA
    'No pressure at all — if it is not a fit right now, just ignore this. Happy to answer questions either way.',
    '',
    // 9: footer (unsubscribe appended by the send pipeline)
    '— CyberShield Cloud',
    'Website monitoring & security intelligence',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  return `Subject: ${subject}\n\n${body}`;
}
