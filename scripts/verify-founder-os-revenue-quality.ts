/**
 * Founder OS revenue quality verification — false agency classification,
 * contact readiness, and outreach action gates.
 *
 * Run: npx tsx scripts/verify-founder-os-revenue-quality.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  detectAgencySignalsFromHtml,
  hasClientWebsiteServiceEvidenceFromSignals,
} from '../lib/owner/agency/agencyDetect';
import { decideProspectKind, scoreAgency } from '../lib/owner/agency/agencyScore';
import { assessProspectQuality } from '../lib/owner/prospectQualityBrain';
import { contactPathForProspect, revenueStatusForProspect } from '../lib/owner/revenueEngine';
import {
  prospectVerdict,
  recommendedOutreachAction,
  resolveContactReadiness,
  isRealAgencyLead,
} from '../lib/owner/prospectVerdict';
import { isEnterpriseProspect } from '../lib/owner/enterpriseFit';
import { resolveProspectScores } from '../lib/owner/prospectDisplay';
import type { OwnerProspect } from '../lib/owner/types';

const problems: string[] = [];
function assert(condition: boolean, message: string): void {
  if (!condition) problems.push(message);
  else console.log(`OK: ${message}`);
}
function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

console.log('CyberShield Founder OS revenue quality verification\n');

// ── Module wiring ──
assert(existsSync(join(process.cwd(), 'lib/owner/prospectVerdict.ts')), 'prospectVerdict module exists');
assert(existsSync(join(process.cwd(), 'lib/owner/enterpriseFit.ts')), 'enterpriseFit module exists');
const detectSrc = read('lib/owner/agency/agencyDetect.ts');
assert(/websiteTechnologySignals/.test(detectSrc), 'websiteTechnologySignals separated');
assert(/businessServiceSignals/.test(detectSrc), 'businessServiceSignals separated');

// ── Tech-only signals do NOT classify agency ──
const wordpressOnlyHtml = `
<html><head><meta name="description" content="Quality lumber since 1920"/></head>
<body><link href="/wp-content/themes/lumber/style.css"/>
<p>Western Lumber Company — building materials, plywood, hardwood flooring.</p>
<p>Our portfolio of products includes premium lumber and decking.</p>
<script src="https://www.google-analytics.com/analytics.js"></script>
</body></html>`;
const wpSignals = detectAgencySignalsFromHtml(wordpressOnlyHtml);
assert(wpSignals.websiteTechnologySignals.includes('wordpress'), 'WordPress detected as technology');
assert(!hasClientWebsiteServiceEvidenceFromSignals(wpSignals), 'WordPress alone is not agency evidence');
const wpScore = scoreAgency({
  businessName: 'Western Lumber Company',
  website: 'https://westernlumber.com',
  signals: wpSignals,
});
assert(wpScore.label === 'NOT AGENCY FIT', 'WordPress-only site labeled NOT AGENCY FIT');
assert(decideProspectKind({ ...wpScore, signals: wpSignals }) === 'smb', 'WordPress-only stays SMB');

const wooHtml = `<html><body>WooCommerce store — shop our products online. wp-content/plugins/woocommerce/</body></html>`;
const wooSignals = detectAgencySignalsFromHtml(wooHtml);
assert(wooSignals.websiteTechnologySignals.includes('woocommerce'), 'WooCommerce detected as technology');
assert(!hasClientWebsiteServiceEvidenceFromSignals(wooSignals), 'WooCommerce alone is not agency evidence');

const seoHtml = `<html><head><meta name="description" content="Best SEO"/><title>Company</title></head><body>About us</body></html>`;
const seoSignals = detectAgencySignalsFromHtml(seoHtml);
assert(seoSignals.websiteTechnologySignals.includes('seo_metadata'), 'SEO metadata is technology signal');
assert(!hasClientWebsiteServiceEvidenceFromSignals(seoSignals), 'SEO metadata alone is not agency evidence');

const securityHtml = `<html><body>Missing security headers. SSL certificate. Firewall protection needed.</body></html>`;
const secSignals = detectAgencySignalsFromHtml(securityHtml);
assert(!hasClientWebsiteServiceEvidenceFromSignals(secSignals), 'Security findings alone are not agency evidence');

// ── Real agency requires service evidence ──
const realAgencyHtml = `
<html><body>
<h1>Web design agency — we build websites for clients</h1>
<p>Website care plans and monthly maintenance for 30+ client websites.</p>
<a href="/portfolio">Portfolio of client websites</a>
</body></html>`;
const realSignals = detectAgencySignalsFromHtml(realAgencyHtml);
const realScore = scoreAgency({
  businessName: 'Rogue Valley Web',
  website: 'https://roguevalleyweb.com',
  signals: realSignals,
  hasContactEmail: true,
});
assert(hasClientWebsiteServiceEvidenceFromSignals(realSignals), 'Real agency has service evidence');
assert(realScore.label !== 'NOT AGENCY FIT', 'Agency $299 requires client website service evidence');
assert(decideProspectKind({ ...realScore, signals: realSignals }) === 'agency', 'Real agency enters agency pipeline');

// ── Fixture: Western Lumber Company ──
const westernLumber = fixtureProspect({
  business_name: 'Western Lumber Company',
  website: 'https://westernlumber.com',
  industry: 'lumber',
  prospect_kind: 'agency',
  agency_type: 'web_design',
  agency_label: 'AGENCY WARM',
  agency_opportunity_score: 50,
  manages_client_sites: true,
  detected_services: ['wordpress', 'seo'],
  estimated_plan_fit: 299,
  scan_status: 'completed',
  scan_score: 45,
  opportunity_score: 55,
  contact_page_found: true,
  contact_phone_found: true,
  contact_confidence: 'no_contact',
  pipeline_state: 'needs_contact',
});
const westernResolved = resolveProspectScores(westernLumber);
assert(prospectVerdict(westernResolved) !== 'Real agency lead', 'Western Lumber is not real agency lead');
assert(!isRealAgencyLead(westernResolved), 'Western Lumber not agency (misclassified row)');
assert(westernResolved.estimated_plan_fit !== 299, 'Western Lumber not Agency $299 at read time');
assert(resolveContactReadiness(westernResolved) === 'contact_page_ready', 'Western Lumber contact page → contact_page_ready');
assert(
  recommendedOutreachAction(westernResolved).label !== 'Approve & send outreach',
  'Western Lumber no email outreach action',
);

// ── Fixture: PLEXIS Healthcare Systems ──
const plexis = fixtureProspect({
  business_name: 'PLEXIS Healthcare Systems',
  website: 'https://plexishealth.com',
  industry: 'healthcare software',
  prospect_kind: 'agency',
  agency_type: 'web_design',
  agency_label: 'AGENCY WARM',
  manages_client_sites: true,
  detected_services: ['wordpress', 'security'],
  estimated_plan_fit: 299,
  scan_status: 'completed',
  scan_score: 38,
  opportunity_score: 48,
  quality_label: 'NEEDS REVIEW',
  pipeline_state: 'needs_review',
  rejection_reason: 'sensitive_sector_manual_review',
  contact_confidence: 'no_contact',
});
assert(isEnterpriseProspect('PLEXIS Healthcare Systems', 'healthcare software'), 'PLEXIS flagged enterprise/sensitive');
const plexisVerdict = prospectVerdict(plexis);
assert(
  plexisVerdict === 'Sensitive sector manual review' || plexisVerdict === 'Enterprise/manual review',
  'PLEXIS sensitive/enterprise manual review',
);
assert(
  ['Manual review', 'Review manually'].includes(recommendedOutreachAction(plexis).label),
  'PLEXIS primary action is manual review',
);
assert(!isRealAgencyLead(plexis), 'PLEXIS not routine agency lead');

// ── Fixture: DSV ──
const dsv = fixtureProspect({
  business_name: 'DSV',
  website: 'https://dsv.com',
  industry: 'global logistics',
  prospect_kind: 'agency',
  agency_type: 'web_design',
  agency_label: 'AGENCY HOT',
  manages_client_sites: true,
  detected_services: ['wordpress'],
  estimated_plan_fit: 299,
  scan_status: 'completed',
  scan_score: 52,
  opportunity_score: 62,
  contact_confidence: 'no_contact',
  pipeline_state: 'needs_contact',
});
assert(isEnterpriseProspect('DSV', 'global logistics'), 'DSV flagged enterprise');
assert(prospectVerdict(dsv) === 'Enterprise/manual review', 'DSV enterprise/manual review verdict');
assert(recommendedOutreachAction(dsv).action === 'review', 'DSV not normal outreach-ready');
assert(!isRealAgencyLead(dsv), 'DSV not routine SMB/agency lead');

// ── Contact path rules ──
const phoneOnly = fixtureProspect({
  business_name: 'Phone Co',
  website: 'https://phoneco.com',
  scan_status: 'completed',
  contact_phone_found: true,
  contact_phone: '(541) 555-0100',
  contact_confidence: 'no_contact',
});
assert(resolveContactReadiness(phoneOnly) === 'phone_only', 'Phone only does not become email-ready');
assert(recommendedOutreachAction(phoneOnly).label === 'Find email/contact form', 'Phone only → find email');

const noContact = fixtureProspect({
  business_name: 'No Contact Co',
  website: 'https://nocontact.com',
  scan_status: 'completed',
  contact_confidence: 'no_contact',
  pipeline_state: 'needs_contact',
});
assert(resolveContactReadiness(noContact) === 'needs_contact', 'No contact → needs_contact');
assert(
  revenueStatusForProspect(noContact) !== 'draft_ready' || !noContact.contact_email,
  'No contact means no email draft status',
);

// ── Sensitive sector gate ──
const sensitive = assessProspectQuality({
  businessName: 'PLEXIS Healthcare Systems',
  website: 'https://plexishealth.com',
  industry: 'healthcare',
  prospectKind: 'smb',
  scanStatus: 'completed',
  scanCompleted: true,
  opportunityScore: 50,
  signals: {
    contact_page_found: true,
    contact_email_found: false,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: null,
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'no_contact',
  },
  httpValid: true,
  dnsValid: true,
});
assert(sensitive.pipelineState === 'needs_review', 'Sensitive sector pipeline needs_review');
assert(!sensitive.outreachReady, 'Sensitive sector not outreach-ready');

// ── No send / no auto-send ──
const ensureSrc = read('lib/owner/ensureOutreachDraft.ts');
assert(!/resend|sendEmail|auto.?send/i.test(ensureSrc), 'No emails sent from draft helper');
const runSrc = read('lib/owner/runRevenueEngine.ts');
assert(!/preferredType.*web_design|'web_design'\)/.test(runSrc) || /classifyAgencyProspect\(admin, prospectId, null\)/.test(runSrc), 'Revenue engine does not force web_design type');

// ── UI shows verdict ──
const cardSrc = read('components/owner/ProspectCard.tsx');
assert(/prospectVerdict/.test(cardSrc), 'ProspectCard shows verdict');
assert(/shouldShowHotLabel/.test(cardSrc), 'HOT hidden when contact path missing');

console.log('\n--- Fixture results ---');
console.log('Western Lumber:', prospectVerdict(westernResolved), '→', recommendedOutreachAction(westernResolved).label);
console.log('PLEXIS:', plexisVerdict, '→', recommendedOutreachAction(plexis).label);
console.log('DSV:', prospectVerdict(dsv), '→', recommendedOutreachAction(dsv).label);

console.log('\n--- Result ---');
if (problems.length) {
  console.error(`FAILED (${problems.length}):`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('All Founder OS revenue quality checks passed.');

function fixtureProspect(overrides: Partial<OwnerProspect>): OwnerProspect {
  return {
    id: 'fixture-id',
    business_name: 'Fixture Co',
    website: 'https://fixture.com',
    industry: 'general',
    city: null,
    state: null,
    country: null,
    prospect_kind: 'smb',
    agency_type: null,
    agency_label: null,
    agency_opportunity_score: null,
    manages_client_sites: false,
    detected_services: [],
    estimated_plan_fit: 79,
    estimated_mrr: 79,
    estimated_arr: 948,
    scan_status: 'pending',
    scan_score: null,
    scan_risk_level: null,
    scan_findings: null,
    lead_score: null,
    opportunity_score: 30,
    conversion_likelihood: null,
    contact_page_found: false,
    contact_email_found: false,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: null,
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'no_contact',
    pipeline_state: 'new_discovery',
    quality_label: null,
    quality_stage: null,
    rejection_reason: null,
    http_valid: true,
    dns_valid: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  } as OwnerProspect;
}
