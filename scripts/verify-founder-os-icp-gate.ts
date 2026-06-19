/**
 * Founder OS ICP / buyer-fit gate verification.
 *
 * Run: npx tsx scripts/verify-founder-os-icp-gate.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  evaluateBuyerFit,
  evaluateBuyerFitFixture,
  computeIcpQueueSnapshot,
} from '../lib/owner/icpGate';
import { canCreateOutreachDraft } from '../lib/owner/prospectQualityBrain';
import { recommendedOutreachAction } from '../lib/owner/prospectVerdict';
import { isTrulyOutreachReady } from '../lib/owner/prospectDisplay';
import { generateOutreach } from '../lib/owner/generators/outreach';
import type { OwnerProspect } from '../lib/owner/types';

const problems: string[] = [];
function assert(condition: boolean, message: string): void {
  if (!condition) problems.push(message);
  else console.log(`OK: ${message}`);
}
function read(rel: string): string {
  const p = join(process.cwd(), rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

console.log('CyberShield Founder OS ICP gate verification\n');

assert(existsSync(join(process.cwd(), 'lib/owner/icpGate.ts')), 'icpGate module exists');

const BLOCKED_FIXTURES: Array<{ name: string; website: string; industry?: string; extra?: Partial<OwnerProspect> }> = [
  { name: 'Heart Hospital of Austin', website: 'https://stdavids.com', industry: 'healthcare' },
  { name: 'Centennial', website: 'https://centennialco.gov', industry: 'government' },
  { name: "McDonald's", website: 'https://mcdonalds.com', industry: 'restaurant' },
  { name: 'Dollar General', website: 'https://dollargeneral.com', industry: 'retail' },
  { name: 'Dollar Tree', website: 'https://dollartree.com', industry: 'retail' },
  { name: 'City of Vancouver', website: 'https://cityofvancouver.us', industry: 'government' },
  { name: 'Denver', website: 'https://denvergov.org', industry: 'government' },
  { name: 'Hillsboro', website: 'https://hillsboro-oregon.gov', industry: 'government' },
  { name: 'Tigard', website: 'https://tigard-or.gov', industry: 'government' },
  { name: 'Eagle Point', website: 'https://cityofeaglepoint.org', industry: 'government' },
  { name: 'South Austin Church of the Nazarene', website: 'https://southaustinnaz.org', industry: 'church' },
  { name: 'Fairview Church of Christ', website: 'https://fairviewchurch.org', industry: 'church' },
  { name: 'Redeemer Lutheran School', website: 'https://redeemer-lutheran.org', industry: 'school' },
  { name: 'Jewett Elementary School', website: 'https://jewett.k12.or.us', industry: 'school' },
  { name: 'Texan Surgery Center', website: 'https://texansurgery.com', industry: 'medical' },
  { name: 'Christ Apostolic Church', website: 'https://christapostolic.org', industry: 'church' },
  {
    name: 'Del Valle Opportunity Center',
    website: 'https://delvalle.opportunity.org',
    industry: 'school',
    extra: { scan_status: 'failed', contact_confidence: 'no_contact' },
  },
];

for (const f of BLOCKED_FIXTURES) {
  const fit = evaluateBuyerFitFixture({
    business_name: f.name,
    website: f.website,
    industry: f.industry ?? null,
    scan_status: 'completed',
    scan_score: 45,
    opportunity_score: 55,
    scan_findings: { issues: ['Missing Strict-Transport-Security header'] },
    contact_email: 'info@example.com',
    contact_confidence: 'generic_public_inbox',
    pipeline_state: 'outreach_ready',
    quality_label: 'HOT',
    ...f.extra,
  });
  assert(!fit.sendQueueEligible, `${f.name} blocked from send queue`);
  assert(!fit.emailDraftAllowed, `${f.name} cannot get email draft`);
  assert(fit.qualityLabel !== 'HOT', `${f.name} is not HOT`);
}

const MANUAL_REVIEW = [
  { name: 'Laguna Gloria Art Museum', website: 'https://lagunagloria.org', industry: 'museum' },
  { name: 'Creston Community Convergence', website: 'https://crestoncommunity.org', industry: 'nonprofit' },
  { name: 'Irvington Neighborhood', website: 'https://irvingtonpdx.org', industry: 'community association' },
  { name: 'Portland Public Schools', website: 'https://pps.org', industry: 'school district' },
];

for (const f of MANUAL_REVIEW) {
  const fit = evaluateBuyerFitFixture({
    business_name: f.name,
    website: f.website,
    industry: f.industry,
    scan_status: 'completed',
    scan_score: 50,
    opportunity_score: 50,
    scan_findings: { issues: ['Missing security header'] },
    contact_email: 'info@example.com',
    contact_confidence: 'generic_public_inbox',
  });
  assert(
    fit.revenueQueue === 'manual_review' || fit.revenueQueue === 'rejected_not_icp',
    `${f.name} manual review or not ICP (not auto-send)`,
  );
  assert(!fit.sendQueueEligible, `${f.name} not in send queue`);
}

const SMB_CANDIDATES = [
  { name: 'Rogue Disposal & Recycling', website: 'https://roguedisposal.com' },
  { name: 'Mt. Ashland Ski Area', website: 'https://mtashland.com' },
  { name: 'Oregon Floor Trends', website: 'https://oregonfloortrends.com' },
  { name: 'All-Ways Trucking', website: 'https://allwaystrucking.com' },
  { name: 'The LandMark Inn', website: 'https://landmarkinn.com' },
  { name: 'Three Penny Mercantile', website: 'https://threepennymercantile.com' },
  { name: 'Central Oregon Lawn Center', website: 'https://centraloregonlawn.com' },
];

for (const f of SMB_CANDIDATES) {
  const host = new URL(f.website).hostname;
  const withEmail = evaluateBuyerFitFixture({
    business_name: f.name,
    website: f.website,
    industry: 'local business',
    scan_status: 'completed',
    scan_score: 55,
    opportunity_score: 55,
    scan_findings: { issues: ['Missing HSTS header'] },
    contact_email: `info@${host}`,
    contact_confidence: 'generic_public_inbox',
  });
  assert(withEmail.buyerFitPassed, `${f.name} can pass buyer-fit with email`);
  assert(withEmail.sendQueueEligible, `${f.name} email-ready enters send queue when rules pass`);

  const formOnly = evaluateBuyerFitFixture({
    business_name: f.name,
    website: f.website,
    industry: 'local business',
    scan_status: 'completed',
    scan_score: 55,
    opportunity_score: 55,
    scan_findings: { issues: ['Missing HSTS header'] },
    contact_page_found: true,
    contact_confidence: 'no_contact',
  });
  assert(formOnly.formQueueEligible, `${f.name} contact page → form queue`);
  assert(!formOnly.emailDraftAllowed, `${f.name} form-only cannot email draft`);
}

assert(
  evaluateBuyerFitFixture({ opportunity_score: 0, scan_score: 40, scan_status: 'completed' }).qualityLabel !== 'HOT',
  'fit score 0 cannot be HOT',
);

const pub = fixture({
  business_name: 'Centennial',
  website: 'https://centennialco.gov',
  rejection_reason: 'public_institution',
  quality_label: 'REJECTED',
  pipeline_state: 'bad_fit',
  opportunity_score: 0,
});
const pubAction = recommendedOutreachAction(pub);
assert(pubAction.action !== 'outreach', 'rejected public institution cannot show Generate outreach');
assert(!isTrulyOutreachReady(pub), 'rejected public institution not outreach ready');

const noContact = fixture({
  business_name: 'No Contact LLC',
  website: 'https://nocontactllc.com',
  opportunity_score: 60,
  scan_score: 50,
  scan_status: 'completed',
  scan_findings: { issues: ['Missing CSP'] },
  contact_confidence: 'no_contact',
  pipeline_state: 'needs_contact',
});
assert(!canCreateOutreachDraft(noContact), 'no contact cannot create email draft');
assert(recommendedOutreachAction(noContact).action !== 'outreach', 'no contact no Approve & Send');

const phoneOnly = fixture({
  business_name: 'Phone Co',
  website: 'https://phoneco.com',
  opportunity_score: 55,
  scan_score: 50,
  scan_status: 'completed',
  scan_findings: { issues: ['Missing CSP'] },
  contact_phone_found: true,
  contact_phone: '(541) 555-0100',
  contact_confidence: 'no_contact',
});
assert(!canCreateOutreachDraft(phoneOnly), 'phone-only cannot generate email draft');

const formLead = fixture({
  business_name: 'Form Ready Co',
  website: 'https://formready.com/contact',
  opportunity_score: 55,
  scan_score: 50,
  scan_status: 'completed',
  scan_findings: { issues: ['Missing CSP'] },
  contact_page_found: true,
  contact_confidence: 'no_contact',
});
const formFit = evaluateBuyerFit(formLead);
assert(formFit.formQueueEligible, 'contact form creates form action queue');
assert(formFit.revenueQueue === 'form_queue', 'form queue not email send queue');

const ensureSrc = read('lib/owner/ensureOutreachDraft.ts');
assert(/canCreateOutreachDraft/.test(ensureSrc), 'draft creation uses buyer-fit gate');
assert(!/sendEmail|resend/i.test(ensureSrc), 'no emails sent from draft helper');

const copy = generateOutreach('cold_email', {
  businessName: 'Fairview Church of Christ',
  website: 'https://fairviewchurch.org',
  industry: 'church',
  scanScore: 55,
  issues: ['Missing HSTS header'],
});
assert(!/online orders/i.test(copy), 'church copy avoids online orders language');
assert(copy.length < 1800, 'outreach copy is shorter');

const queue = computeIcpQueueSnapshot([
  fixture({ business_name: 'Centennial', website: 'https://centennialco.gov', rejection_reason: 'public_institution' }),
  fixture({
    business_name: 'Good SMB',
    website: 'https://goodsmb.com',
    opportunity_score: 55,
    scan_score: 50,
    scan_status: 'completed',
    scan_findings: { issues: ['x'] },
    contact_email: 'info@goodsmb.com',
    contact_confidence: 'generic_public_inbox',
  }),
]);
assert(queue.rejectedNotIcp >= 1, 'not-ICP leads shown separately');
assert(queue.sendQueue >= 1, 'send queue contains email-ready ICP leads');

console.log('\n--- Queue snapshot ---');
console.log(JSON.stringify(queue, null, 2));

console.log('\n--- Result ---');
if (problems.length) {
  console.error(`FAILED (${problems.length}):`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('All ICP gate checks passed.');

function fixture(overrides: Partial<OwnerProspect>): OwnerProspect {
  return {
    id: 'x',
    business_name: 'Co',
    website: 'https://example.com',
    industry: null,
    scan_status: 'completed',
    scan_score: 55,
    opportunity_score: 50,
    pipeline_state: 'qualified',
    contact_confidence: 'no_contact',
    created_at: '',
    updated_at: '',
    ...overrides,
  } as OwnerProspect;
}
