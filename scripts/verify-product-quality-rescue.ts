/**
 * Product quality rescue sprint — structural verification.
 * Run: npx tsx scripts/verify-product-quality-rescue.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeEmailEngagementRates,
  formatDeliveryEngagementDetail,
} from '../lib/owner/emailEngagementMetrics';
import { RECOMMENDED_PLAN_PRICES_USD } from '../lib/billing/planFeatures';
import { computePlanFit } from '../lib/owner/salesIntelligence';
import { resolveProspectScores } from '../lib/owner/prospectDisplay';
import type { OwnerProspect } from '../lib/owner/types';

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Product quality rescue verification\n');

// Shared customer metrics
assert(existsSync(join(process.cwd(), 'lib/owner/founderCustomerMetrics.ts')), 'founderCustomerMetrics exists');
assert(read('lib/owner/businessHealthMetrics.ts').includes('getFounderCustomerMetrics'), 'businessHealth uses shared metrics');
assert(read('lib/owner/customerHealth.ts').includes('getFounderCustomerMetrics'), 'customerHealth uses shared metrics');
assert(read('lib/owner/customerDirectory.ts').includes('getFounderCustomerMetrics'), 'customerDirectory uses shared metrics');
assert(read('components/owner/views/CustomersView.tsx').includes('business.payingCustomers'), 'CustomersView uses businessHealth SSOT');

// Email open rate cap
const rates = computeEmailEngagementRates({
  sent: 5,
  bounced: 0,
  openEvents: [
    { delivery_id: 'a' },
    { delivery_id: 'a' },
    { delivery_id: 'b' },
    { delivery_id: 'b' },
    { delivery_id: 'b' },
    { delivery_id: 'c' },
    { delivery_id: 'd' },
    { delivery_id: 'e' },
    { delivery_id: 'f' },
  ],
  clickEvents: [],
});
assert(rates.uniqueOpenRate <= 100, 'unique open rate capped at 100%');
assert(rates.totalOpens === 9 && rates.uniqueOpens === 6, 'tracks total vs unique opens');
assert(formatDeliveryEngagementDetail(rates).includes('Unique open rate'), 'delivery detail shows unique open rate');

// Prospect kind plan fit
const emptySignals = {
  contact_page_found: false,
  contact_email_found: false,
  contact_phone_found: false,
  contact_linkedin_found: false,
  contact_email: null,
  contact_phone: null,
  contact_linkedin: null,
  contact_confidence: 'no_contact' as const,
};

assert(computePlanFit({ industry: 'healthcare', signals: emptySignals, scanCompleted: true, scanScore: 80, scanRiskLevel: 'high', leadScore: 'HOT' }, 80, 'smb') === 149, 'SMB healthcare gets Growth not Agency');
assert(computePlanFit({ industry: 'healthcare', signals: emptySignals, scanCompleted: true, scanScore: 80, scanRiskLevel: 'high', leadScore: 'HOT' }, 80, 'agency') === 299, 'Agency kind gets $299');

const smbProspect = resolveProspectScores({
  id: '1',
  business_name: 'Clinic',
  website: 'https://example.com',
  industry: 'healthcare',
  prospect_kind: 'smb',
  estimated_plan_fit: 299,
  opportunity_score: 70,
  scan_status: 'completed',
  scan_score: 55,
  scan_risk_level: 'medium',
  lead_score: 'WARM',
  pipeline_state: 'qualified',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as OwnerProspect);
assert(smbProspect.estimated_plan_fit !== 299, 'SMB prospect never keeps Agency $299 tag');

// Prospects UI scoping
assert(read('components/owner/LeadDiscovery.tsx').includes('new prospect'), 'discovery copy says new prospects');
assert(read('components/owner/LeadDiscovery.tsx').includes('No agency prospects yet'), 'agency empty state');
assert(read('components/owner/RevenueOpportunityBar.tsx').includes('kindView'), 'revenue bar scoped by view');
assert(read('components/owner/LeadDiscovery.tsx').includes('filterProspectsByKind'), 'prospects filter by kind');

// Founder OS command center
assert(read('components/owner/views/FounderHomeView.tsx').includes('FounderCommandCenterHome'), 'Home uses command center');
assert(read('components/owner/dashboard/FounderCommandCenterHome.tsx').includes('Today'), 'Home has priorities section');

// Agency conversion path
assert(existsSync(join(process.cwd(), 'app/agency/page.tsx')), '/agency page exists');
assert(read('app/agencies/page.tsx').includes('/agency'), '/agencies redirects to /agency');
assert(read('app/signup/page.tsx').includes('signupPlanCopy'), 'signup plan=agency handled');
assert(read('lib/conversion/signupPlanContext.ts').includes('Agency plan'), 'agency signup copy exists');

// QA reset script
assert(existsSync(join(process.cwd(), 'scripts/reset-qa-account-password.ts')), 'QA reset script exists');
assert(read('scripts/reset-qa-account-password.ts').includes('is_qa_account'), 'QA reset requires is_qa_account flag');

// Safety + pricing (delegate to existing invariants patterns)
assert(read('lib/supabase/middleware.ts').includes('isOwnerOnlyPath'), 'Founder OS owner-only');
assert(!read('app/api/cron/prospect-discovery/route.ts').includes('sendApprovedOutreach'), 'no auto-send');
assert(read('lib/owner/followUpScheduler.ts').includes('existingStages'), 'follow-up dedupe intact');
assert(RECOMMENDED_PLAN_PRICES_USD.pro === 79 && RECOMMENDED_PLAN_PRICES_USD.growth === 149 && RECOMMENDED_PLAN_PRICES_USD.agency === 299, 'pricing $79/$149/$299');
assert(read('lib/billing/planFeatures.ts').includes('No automated monitoring'), 'free plan honest');

// No Resend/Stripe config changes in this sprint (grep for risky patterns in changed owner email files only)
const emailHealth = read('lib/owner/emailHealth.ts');
assert(!emailHealth.includes('RESEND_API_KEY='), 'no hardcoded Resend keys in emailHealth');

console.log('\nAll product quality rescue checks passed.');
