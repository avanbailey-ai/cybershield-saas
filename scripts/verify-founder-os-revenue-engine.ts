/**
 * Founder OS revenue engine verification.
 * Run: npx tsx scripts/verify-founder-os-revenue-engine.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRevenueActionCard,
  contactPathForProspect,
  formatRevenueEngineSummary,
  hasUsefulRevenueAction,
  isWeakScanScore,
  revenueStatusForProspect,
} from '../lib/owner/revenueEngine';
import { computeCustomerAcquisitionSnapshot } from '../lib/owner/revenueActions';
import { parseUrlBatch } from '../lib/owner/prospectDiscovery';
import { canCreateOutreachDraft } from '../lib/owner/prospectQualityBrain';
import { ensureOutreachDraft } from '../lib/owner/ensureOutreachDraft';

function read(rel: string): string {
  return existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '';
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Founder OS revenue engine verification\n');

const home = read('components/owner/dashboard/FounderCommandCenterHome.tsx');
const findCustomers = read('components/owner/FindCustomers.tsx');
const leadDiscovery = read('components/owner/LeadDiscovery.tsx');
const engine = read('lib/owner/runRevenueEngine.ts');
const api = read('app/api/owner/revenue-engine/run/route.ts');
const ensureDraft = read('lib/owner/ensureOutreachDraft.ts');
const growth = read('lib/owner/growthAutopilotSettings.ts');

assert(home.includes('customer acquisition work'), 'Home shows customer acquisition work');
assert(home.includes('Find customers'), 'Home has Find customers button');
assert(home.includes('computeCustomerAcquisitionSnapshot'), 'Home uses revenue action snapshot');
assert(findCustomers.includes('Find customers'), 'Find customers workflow exists');
assert(findCustomers.includes('free_sources'), 'Free web sources option');
assert(findCustomers.includes('paste_urls'), 'Paste websites option');
assert(findCustomers.includes('Location optional'), 'Location not required in copy');
assert(leadDiscovery.includes('FindCustomers'), 'Prospects embeds Find customers');
assert(leadDiscovery.includes('website-first'), 'Website-first is default path');
assert(engine.includes('runRevenueEngine'), 'Revenue engine runner exists');
assert(api.includes('revenue-engine/run'), 'Revenue engine API route exists');
assert(!engine.includes('generateFake'), 'no fake prospect generator');
assert(ensureDraft.includes('canCreateOutreachDraft'), 'draft gate preserved');
assert(!ensureDraft.includes('sendEmail'), 'ensureOutreachDraft does not send email');

const parsed = parseUrlBatch('example.com\ncybershieldcloud.com');
assert(parsed.length >= 1, 'paste domains parses without location');

assert(isWeakScanScore(65, 'medium') === true, 'score <= 70 is weak');
assert(isWeakScanScore(85, 'low') === false, 'high score without severity is not urgent');

const needsContact = buildRevenueActionCard({
  business_name: 'Test Co',
  website: 'https://example.com',
  scan_score: 55,
  scan_status: 'completed',
  scan_risk_level: 'high',
  contact_page_found: false,
  contact_email: null,
  pipeline_state: 'needs_contact',
});
assert(needsContact.status === 'needs_contact', 'missing contact becomes Needs contact');

const formReady = buildRevenueActionCard({
  business_name: 'Form Co',
  website: 'https://example.com',
  scan_score: 60,
  scan_status: 'completed',
  scan_risk_level: 'medium',
  contact_page_found: true,
  contact_email: null,
  pipeline_state: 'needs_contact',
});
assert(formReady.status === 'contact_form_ready', 'contact form counts as contact path');
assert(formReady.contactFormUrl !== null, 'contact form URL provided');

const notUrgent = buildRevenueActionCard({
  business_name: 'Secure Co',
  website: 'https://secureco.com',
  scan_score: 92,
  scan_status: 'completed',
  scan_risk_level: 'low',
  pipeline_state: 'qualified',
  contact_email: 'info@secureco.com',
  contact_confidence: 'generic_public_inbox',
});
assert(notUrgent.status === 'not_urgent', 'high-score sites with contact become Not urgent');

const noContactHighScore = buildRevenueActionCard({
  business_name: 'Secure No Contact',
  website: 'https://securenc.com',
  scan_score: 92,
  scan_status: 'completed',
  scan_risk_level: 'low',
  pipeline_state: 'needs_contact',
});
assert(noContactHighScore.status === 'needs_contact', 'high-score sites without contact need enrichment');

const dup = buildRevenueActionCard(
  { business_name: 'Dup', website: 'https://example.com', scan_status: 'completed', scan_score: 50 },
  { isDuplicate: true },
);
assert(dup.status === 'existing_prospect', 'duplicates show existing prospect');

const noOutreachWithoutContact = canCreateOutreachDraft({
  pipeline_state: 'outreach_ready',
  scan_status: 'completed',
  quality_label: 'HOT',
  contact_confidence: 'no_contact',
  contact_email: null,
} as never);
assert(noOutreachWithoutContact === false, 'no outreach-ready without contact path');

const snap = computeCustomerAcquisitionSnapshot([], 0);
assert(snap.summaryLine.includes('weak websites'), 'Home snapshot mentions revenue actions');

const emptyResult = {
  websitesFound: 0,
  websitesScanned: 0,
  weakScoreLeads: 0,
  contactPathsFound: 0,
  draftsGenerated: 0,
  alreadyInPipeline: 0,
  notUrgent: 0,
  failedScans: 0,
  needsContact: 0,
  rejected: 0,
  summaryMessage: '',
  nextRecommendedAction: '',
  results: [],
};
assert(hasUsefulRevenueAction(emptyResult) === false, 'empty run is not falsely useful');
assert(
  !formatRevenueEngineSummary(emptyResult).includes('duplicates skipped'),
  'summary is not raw/duplicate-only',
);

assert(
  contactPathForProspect({ contact_page_found: true, contact_email: null, business_name: 'x', website: 'https://x.com', scan_status: 'completed', pipeline_state: 'needs_contact' }) === 'contact_page_ready',
  'contact page path detection',
);

if (growth) {
  assert(growth.includes('manual') || growth.includes('prepare'), 'auto-send defaults manual/prepare');
}

console.log('\nAll Founder OS revenue engine checks passed.');
