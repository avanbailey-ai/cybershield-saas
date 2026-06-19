/**
 * Verify Prospect Discovery V2 sales intelligence pipeline.
 * Run: npx tsx scripts/verify-prospect-discovery-v2.ts
 */

import fs from 'fs';
import path from 'path';
import {
  computeOpportunityScore,
  isDeprioritizedIndustry,
  buildSelectionReason,
} from '../lib/owner/salesIntelligence';
import { isRejectedWebsite } from '../lib/owner/discovery/validate';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function main() {
  const migration = read('supabase/migrations/20260619000000_prospect_discovery_v2.sql');
  const pipeline = read('lib/owner/pipeline.ts');
  const leadDiscovery = read('components/owner/LeadDiscovery.tsx');
  const prospectCard = read('components/owner/ProspectCard.tsx');
  const engine = read('lib/owner/discovery/engine.ts');
  const bulk = read('app/api/owner/prospects/bulk/route.ts');

  assert(migration.includes('opportunity_score'), 'Migration adds opportunity_score');
  assert(migration.includes('estimated_plan_fit'), 'Migration adds plan fit');
  assert(migration.includes('ignore_forever'), 'Migration adds ignore_forever stage');
  assert(migration.includes('contact_email_found'), 'Migration adds contact availability');

  assert(pipeline.includes('new_discovery'), 'Pipeline includes new_discovery stage');
  assert(pipeline.includes('securityScoreLabel'), 'Pipeline separates security score label');
  assert(pipeline.includes('opportunityScoreLabel'), 'Pipeline has opportunity score label');

  assert(leadDiscovery.includes('Discovery scope'), 'Scope UI replaces radius-only');
  assert(leadDiscovery.includes('outreach-ready'), 'Feed shows business outcomes');
  assert(leadDiscovery.includes('provider diagnostics'), 'Diagnostics hidden behind expand');

  assert(prospectCard.includes('Opportunity'), 'Card shows opportunity score');
  assert(prospectCard.includes('Security'), 'Card shows security score separate');
  assert(prospectCard.includes('Why selected'), 'Card explains selection');
  assert(prospectCard.includes('Generate outreach'), 'Card has outreach action');
  assert(prospectCard.includes('Contact info'), 'Card has contact info');

  assert(engine.includes('loadCustomerHosts'), 'Engine skips customer websites');
  assert(engine.includes('enrichProspect'), 'Engine enriches prospects on insert');
  assert(bulk.includes('ignore_forever'), 'Bulk ignore forever action');
  assert(bulk.includes('mark_contacted'), 'Bulk mark contacted');
  assert(bulk.includes('mark_customer'), 'Bulk mark customer');

  assert(isRejectedWebsite('https://example.com'), 'Rejects example.com');
  assert(isDeprioritizedIndustry('Government services'), 'Deprioritizes government');

  const score = computeOpportunityScore({
    industry: 'Dental',
    businessName: 'Smile Dental',
    scanScore: 42,
    scanRiskLevel: 'high',
    leadScore: 'HOT',
    scanCompleted: true,
    signals: {
      contact_page_found: true,
      contact_email_found: true,
      contact_phone_found: false,
      contact_linkedin_found: false,
      contact_email: 'info@smiledental.com',
      contact_phone: null,
      contact_linkedin: null,
      contact_confidence: 'generic_public_inbox',
    },
    issueCount: 4,
  });
  assert(score >= 40 && score <= 100, 'Opportunity score in range for HOT dental');

  const reason = buildSelectionReason({
    industry: 'Dental',
    businessName: 'Smile Dental',
    scanScore: 42,
    scanRiskLevel: 'high',
    leadScore: 'HOT',
    scanCompleted: true,
    signals: {
      contact_page_found: true,
      contact_email_found: true,
      contact_phone_found: false,
      contact_linkedin_found: false,
      contact_email: null,
      contact_phone: null,
      contact_linkedin: null,
      contact_confidence: 'no_contact',
    },
    opportunityScore: score,
  });
  assert(!reason.includes('example.com'), 'No example domains in selection reason');
  assert(reason.length > 20, 'Selection reason is substantive');

  console.log('\nAll Prospect Discovery V2 checks passed.');
}

main();
