/**
 * Verify Prospect Discovery V3 revenue intelligence platform.
 * Run: npx tsx scripts/verify-prospect-discovery-v3.ts
 */

import fs from 'fs';
import path from 'path';
import { isRejectedWebsite } from '../lib/owner/discovery/validate';
import { hasActiveProspects, stageEmptyMessage } from '../lib/owner/pipeline';
import { computeRevenueIntelligence } from '../lib/owner/revenueIntelligence';
import type { OwnerProspect } from '../lib/owner/types';

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

const sampleProspect = (overrides: Partial<OwnerProspect> = {}): OwnerProspect => ({
  id: '1',
  business_name: 'Acme Dental',
  website: 'https://acmedental.com',
  industry: 'Dental',
  city: 'Medford',
  state: 'OR',
  country: 'US',
  lead_score: 'HOT',
  scan_score: 42,
  scan_risk_level: 'high',
  scan_findings: { issues: ['Missing HSTS'] },
  scan_status: 'completed',
  conversion_likelihood: 80,
  estimated_mrr: 79,
  estimated_arr: 948,
  opportunity_priority: 85,
  opportunity_score: 85,
  estimated_plan_fit: 79,
  contact_page_found: true,
  contact_email_found: true,
  contact_phone_found: false,
  contact_linkedin_found: false,
  contact_email: 'info@acme.com',
  contact_phone: null,
  contact_linkedin: null,
  qualification_reasons: ['Missing HSTS', 'Business email found'],
  selection_reason: 'High opportunity dental practice',
  pipeline_state: 'outreach_ready',
  discovery_source: 'openstreetmap',
  discovery_source_url: null,
  top_issue: 'Missing HSTS',
  dns_valid: true,
  http_valid: true,
  archived_at: null,
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

function main() {
  const leadDiscovery = read('components/owner/LeadDiscovery.tsx');
  const prospectPipeline = read('components/owner/ProspectPipeline.tsx');
  const prospectCard = read('components/owner/ProspectCard.tsx');
  const settings = read('lib/owner/discovery/settings.ts');
  const revenueBar = read('components/owner/RevenueOpportunityBar.tsx');

  // Contradictory state fix
  assert(
    leadDiscovery.includes('!hasProspects ? discoveryEmpty : <ProspectPipeline'),
    'Mutually exclusive empty state vs pipeline',
  );
  assert(
    prospectPipeline.includes('if (!globalHasProspects)') &&
      prospectPipeline.includes('return null'),
    'Pipeline hidden when no global prospects',
  );
  assert(!leadDiscovery.includes('No prospects discovered yet'), 'No legacy contradictory empty copy');

  assert(isRejectedWebsite('https://example.com'), 'Rejects example domains');

  const withProspects = [sampleProspect()];
  const withoutProspects: OwnerProspect[] = [];
  assert(hasActiveProspects(withProspects), 'Detects active prospects');
  assert(!hasActiveProspects(withoutProspects), 'No false positive on empty');

  const globalEmpty = stageEmptyMessage('new_discovery', false);
  const tabEmpty = stageEmptyMessage('outreach_ready', true);
  assert(globalEmpty.title.includes('No qualified prospects'), 'Premium global empty state');
  assert(tabEmpty.title.includes('No prospects in'), 'Stage-specific empty when prospects exist');

  assert(prospectCard.includes('Opportunity') && prospectCard.includes('Security'), 'Scores separated');
  assert(prospectCard.includes('Why this business matters'), 'Opportunity reasoning');
  assert(prospectCard.includes('Recommended next action'), 'Recommended next action');
  const salesIntel = read('lib/owner/salesIntelligence.ts');
  assert(
    salesIntel.includes('Contact available') && salesIntel.includes('No contact found'),
    'Contact intelligence',
  );

  assert(prospectPipeline.includes('ignore_forever'), 'Ignore forever bulk');
  assert(prospectPipeline.includes('mark_contacted'), 'Mark contacted bulk');
  assert(prospectPipeline.includes('stageCounts'), 'Pipeline stage counts');

  assert(leadDiscovery.includes('advanced diagnostics'), 'Advanced diagnostics collapsed label');
  assert(!leadDiscovery.includes('openstreetmap: succeeded'), 'No raw provider logs in main feed');
  assert(leadDiscovery.includes('businesses found'), 'Discovery feed uses business outcomes');

  assert(settings.includes('25 miles') && settings.includes('customRadiusMiles'), 'Radius UI uses miles not meters');
  assert(!settings.includes('~5 km'), 'No km hints in scope options');

  assert(revenueBar.includes('Revenue intelligence'), 'Revenue opportunity summary exists');
  assert(leadDiscovery.includes('RevenueOpportunityBar'), 'Revenue bar integrated');

  const rev = computeRevenueIntelligence(withProspects);
  assert(rev.outreachReady === 1, 'Revenue summary from real plan fit');
  assert(rev.estimatedMonthlyRevenue === 79, 'MRR from estimated_plan_fit only');

  console.log('\nAll Prospect Discovery V3 checks passed.');
}

main();
