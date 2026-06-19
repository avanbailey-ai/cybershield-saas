/**
 * Whole-pipeline buyer-fit gate verification.
 * Run: npx tsx scripts/verify-founder-os-whole-pipeline-gate.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  classifyProspectsByQueue,
  resolvePipelineVerdict,
  resolveQueuePlacement,
  isDraftBlocked,
} from '../lib/owner/pipelineGate';
import { evaluateBuyerFitFixture } from '../lib/owner/icpGate';
import { canCreateOutreachDraft } from '../lib/owner/prospectQualityBrain';
import { recommendedOutreachAction } from '../lib/owner/prospectVerdict';
import { computeCustomerAcquisitionSnapshot } from '../lib/owner/revenueActions';
import type { OwnerProspect } from '../lib/owner/types';

const problems: string[] = [];
function assert(condition: boolean, message: string): void {
  if (!condition) problems.push(message);
  else console.log(`OK: ${message}`);
}
function read(rel: string): string {
  return existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '';
}

console.log('CyberShield Founder OS whole-pipeline gate verification\n');

assert(existsSync(join(process.cwd(), 'lib/owner/pipelineGate.ts')), 'pipelineGate module exists');
assert(read('components/owner/ProspectPipelineBuckets.tsx').includes('classifyProspectsByQueue'), 'Prospects view uses shared queue buckets');
assert(read('components/owner/dashboard/FounderCommandCenterHome.tsx').includes('computeCustomerAcquisitionSnapshot'), 'Home uses shared acquisition snapshot');
assert(read('components/owner/ProspectsActionQueue.tsx').includes('isDraftBlocked'), 'Send queue filters blocked drafts');
assert(read('lib/owner/revenueIntelligence.ts').includes('isEmailSendEligible'), 'Revenue intelligence uses ICP send gate');
assert(read('lib/owner/prospectFilters.ts').includes('evaluateBuyerFit'), 'Prospect filters use ICP gate');

const BLOCKED: Array<{
  name: string;
  website: string;
  industry?: string;
  extra?: Partial<OwnerProspect>;
  expectManual?: boolean;
}> = [
  { name: 'Centennial', website: 'https://centennialco.gov', industry: 'government' },
  { name: 'Denver', website: 'https://denvergov.org', industry: 'government' },
  { name: 'Hillsboro', website: 'https://hillsboro-oregon.gov', industry: 'government' },
  { name: 'Tigard', website: 'https://tigard-or.gov', industry: 'government' },
  { name: 'Eagle Point', website: 'https://cityofeaglepoint.org', industry: 'government' },
  { name: 'City of Vancouver', website: 'https://cityofvancouver.us', industry: 'government' },
  { name: "McDonald's", website: 'https://mcdonalds.com', industry: 'restaurant' },
  { name: 'Dollar General', website: 'https://dollargeneral.com', industry: 'retail' },
  { name: 'Dollar Tree', website: 'https://dollartree.com', industry: 'retail' },
  { name: 'Phillips 66', website: 'https://phillips66gas.com', industry: 'retail' },
  { name: 'Heart Hospital of Austin', website: 'https://stdavids.com', industry: 'healthcare' },
  { name: 'Texan Surgery Center', website: 'https://texansurgery.com', industry: 'medical' },
  { name: 'Cornerstone Hospital Austin', website: 'https://chghospitals.com', industry: 'healthcare' },
  { name: 'South Austin Church of the Nazarene', website: 'https://southaustinnaz.org', industry: 'church' },
  { name: 'Fairview Church of Christ', website: 'https://fvcofc.com', industry: 'church' },
  { name: 'Christ Apostolic Church', website: 'https://faithweb.com', industry: 'church' },
  { name: 'Redeemer Lutheran School', website: 'https://redeemerschool.net', industry: 'school' },
  { name: 'Jewett Elementary School', website: 'https://district6.org', industry: 'school' },
  {
    name: 'Del Valle Opportunity Center',
    website: 'https://schoolwebpages.com/delvalle',
    industry: 'school',
  },
  { name: 'Ashland Community Center', website: 'https://ashland.or.us', industry: 'government' },
  { name: 'Elisabet Ney Museum', website: 'https://austintexas.gov', industry: 'government' },
  { name: 'Creston Community Convergence', website: 'https://cityrepair.org', industry: 'nonprofit', expectManual: true },
  { name: 'Irvington', website: 'https://irvingtonpdx.com', industry: 'community', expectManual: true },
  {
    name: 'Portland Public Schools',
    website: 'https://www.pps.org',
    industry: 'school',
    extra: { contact_email: 'inquiries@pps.org', contact_confidence: 'likely_business_email' },
  },
];

for (const f of BLOCKED) {
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
  assert(fit.qualityLabel !== 'HOT', `${f.name} is not HOT`);
  if (f.expectManual) {
    assert(fit.revenueQueue === 'manual_review', `${f.name} → manual review`);
  }
  const action = recommendedOutreachAction({
    id: 'x',
    business_name: f.name,
    website: f.website,
    industry: f.industry ?? null,
    scan_status: 'completed',
    scan_score: 45,
    opportunity_score: 55,
    scan_findings: { issues: ['Missing HSTS'] },
    contact_email: f.extra?.contact_email ?? 'info@example.com',
    contact_confidence: (f.extra?.contact_confidence as never) ?? 'generic_public_inbox',
    pipeline_state: 'outreach_ready',
    created_at: '',
    updated_at: '',
    ...f.extra,
  } as OwnerProspect);
  assert(
    !action.label.toLowerCase().includes('approve') || fit.revenueQueue === 'manual_review',
    `${f.name} no Approve & Send by default`,
  );
}

const USABLE = [
  'Rogue Disposal & Recycling',
  'Mt. Ashland Ski Area',
  'Oregon Floor Trends',
  'All-Ways Trucking',
  'The LandMark Inn',
  'Three Penny Mercantile',
  'Central Oregon Lawn Center',
];

for (const name of USABLE) {
  const emailReady = evaluateBuyerFitFixture({
    business_name: name,
    website: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    industry: 'business',
    scan_status: 'completed',
    scan_score: 55,
    opportunity_score: 58,
    scan_findings: { issues: ['Missing CSP'] },
    contact_email: 'info@example.com',
    contact_confidence: 'generic_public_inbox',
  });
  assert(
    emailReady.sendQueueEligible || emailReady.formQueueEligible || emailReady.revenueQueue === 'needs_contact',
    `${name} can land in a valid revenue queue when rules pass`,
  );
}

assert(
  evaluateBuyerFitFixture({ opportunity_score: 0, scan_score: 40, scan_status: 'completed' }).qualityLabel !==
    'HOT',
  'fit score 0 cannot be HOT',
);

assert(
  !canCreateOutreachDraft({
    pipeline_state: 'bad_fit',
    scan_status: 'completed',
    quality_label: 'REJECTED',
    contact_email: 'info@test.com',
    contact_confidence: 'generic_public_inbox',
    opportunity_score: 55,
    scan_findings: { issues: ['x'] },
    rejection_reason: 'public_institution',
  }),
  'rejected cannot create email draft',
);

const noContact = evaluateBuyerFitFixture({
  scan_status: 'completed',
  scan_score: 45,
  opportunity_score: 55,
  scan_findings: { issues: ['Missing CSP'] },
  contact_confidence: 'no_contact',
});
assert(!noContact.sendQueueEligible, 'no contact not in send queue');

const phoneOnly = evaluateBuyerFitFixture({
  scan_status: 'completed',
  scan_score: 45,
  opportunity_score: 55,
  scan_findings: { issues: ['Missing CSP'] },
  contact_phone_found: true,
  contact_confidence: 'no_contact',
});
assert(phoneOnly.contactStatus === 'PHONE_ONLY', 'phone-only detected');
assert(!phoneOnly.sendQueueEligible, 'phone-only not send queue');

const formLead = evaluateBuyerFitFixture({
  business_name: 'Local Shop',
  website: 'https://localshop.com/contact-us',
  industry: 'retail',
  scan_status: 'completed',
  scan_score: 50,
  opportunity_score: 50,
  scan_findings: { issues: ['Missing CSP'] },
  contact_page_found: true,
  contact_confidence: 'no_contact',
});
assert(formLead.formQueueEligible || formLead.revenueQueue === 'form_queue', 'contact form → form queue');
assert(!formLead.sendQueueEligible, 'form-only not email send queue');

const falseAgency = evaluateBuyerFitFixture({
  prospect_kind: 'agency',
  manages_client_sites: true,
  detected_services: ['wordpress', 'seo', 'security'],
  agency_label: 'AGENCY WARM',
  scan_status: 'completed',
  scan_score: 50,
  opportunity_score: 54,
  scan_findings: { issues: ['Missing CSP'] },
  contact_email: 'info@agency.com',
  contact_confidence: 'generic_public_inbox',
});
assert(falseAgency.planFit !== 299, 'Agency $299 requires real agency evidence');

const blockedDraft = isDraftBlocked(
  {
    id: '1',
    business_name: 'Centennial',
    website: 'https://centennialco.gov',
    industry: 'government',
    scan_status: 'completed',
    scan_score: 45,
    opportunity_score: 55,
    scan_findings: { issues: ['x'] },
    contact_email: 'info@centennialco.gov',
    contact_confidence: 'generic_public_inbox',
    pipeline_state: 'outreach_ready',
    rejection_reason: 'public_institution',
    created_at: '',
    updated_at: '',
  } as unknown as OwnerProspect,
  { send_error: 'Draft blocked — buyer-fit/contact rules failed: public institution' },
);
assert(blockedDraft, 'stale draft blocked when prospect fails rules');

const sampleProspects: OwnerProspect[] = [
  {
    id: 'a',
    business_name: 'Good SMB',
    website: 'https://good-smb.com',
    industry: 'retail',
    scan_status: 'completed',
    scan_score: 50,
    opportunity_score: 58,
    scan_findings: { issues: ['Missing CSP'] },
    contact_email: 'info@good-smb.com',
    contact_confidence: 'generic_public_inbox',
    pipeline_state: 'outreach_ready',
    created_at: '',
    updated_at: '',
  } as unknown as OwnerProspect,
  {
    id: 'b',
    business_name: 'Centennial',
    website: 'https://centennialco.gov',
    industry: 'government',
    scan_status: 'completed',
    scan_score: 45,
    opportunity_score: 55,
    scan_findings: { issues: ['x'] },
    rejection_reason: 'public_institution',
    pipeline_state: 'bad_fit',
    created_at: '',
    updated_at: '',
  } as unknown as OwnerProspect,
];

const buckets = classifyProspectsByQueue(sampleProspects);
const snap = computeCustomerAcquisitionSnapshot(sampleProspects);
assert(buckets.send_queue.length === snap.sendQueue, 'Home counts match queue placement');
assert(buckets.rejected_not_icp.length === snap.rejectedNotIcp, 'Rejected counts match');

assert(
  read('lib/owner/ensureOutreachDraft.ts').includes('canCreateOutreachDraft'),
  'draft generation uses quality gate',
);
assert(
  !read('app/api/cron/growth-autopilot/route.ts').includes('sendApprovedOutreach') ||
    read('lib/owner/growthAutopilotSettings.ts').includes("mode === 'manual'"),
  'auto-send remains off by default',
);

if (problems.length > 0) {
  console.error('\nFAIL: whole-pipeline gate issues:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('\nAll whole-pipeline gate checks passed.');
