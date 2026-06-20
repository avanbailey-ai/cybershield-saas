/**
 * Pricing/plan SSOT consistency — Pro, Growth, Agency, Enterprise marketing copy.
 * Run: npx tsx scripts/verify-plan-consistency.ts
 */

import { PLAN_LIMITS, BILLED_PLANS, formatDeepScanLimit } from '../lib/billing/plans';
import {
  RECOMMENDED_PLAN_PRICES_USD,
  PLAN_MARKETING,
  getPlanMarketing,
} from '../lib/billing/planFeatures';
import { PLANS as CORE_PLANS } from '../core/billing/plans';
import { canUsePriorityMonitoring } from '../lib/billing/priorityMonitoring';
import { getEligibleFrequencyMinutes } from '../lib/jobs/scanFrequency';

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

function fail(label: string): never {
  console.error(`FAIL: ${label}`);
  process.exit(1);
}

function check(condition: boolean, label: string): void {
  if (condition) pass(label);
  else fail(label);
}

console.log('CyberShield plan consistency verification\n');

// --- Prices ---
check(RECOMMENDED_PLAN_PRICES_USD.pro === 79, 'Pro price = 79');
check(RECOMMENDED_PLAN_PRICES_USD.growth === 149, 'Growth price = 149');
check(RECOMMENDED_PLAN_PRICES_USD.agency === 299, 'Agency price = 299');

// --- Website limits ---
check(PLAN_LIMITS.pro.websites === 10, 'Pro website limit = 10');
check(PLAN_LIMITS.growth.websites === 50, 'Growth website limit = 50');
check(PLAN_LIMITS.agency.websites === 250, 'Agency website limit = 250');

// --- Manual deep scan limits ---
check(PLAN_LIMITS.pro.maxScansPerDay === 10, 'Pro manual deep scan limit = 10/day');
check(PLAN_LIMITS.growth.maxScansPerDay === 50, 'Growth manual deep scan limit = 50/day');
check(PLAN_LIMITS.agency.maxScansPerDay === 100, 'Agency manual deep scan limit = 100/day');

// --- Monitoring cadence ---
check(PLAN_LIMITS.pro.scanFrequency === 'daily', 'Pro monitoring cadence = daily');
check(PLAN_LIMITS.growth.scanFrequency === 'hourly', 'Growth monitoring cadence = hourly');
check(
  getEligibleFrequencyMinutes('pro', 'daily_scan') === 24 * 60,
  'Pro daily_scan interval = 24h',
);
check(
  getEligibleFrequencyMinutes('growth', 'daily_scan') === 60,
  'Growth daily_scan interval = 1h',
);

// --- Agency priority slots ---
check(
  (PLAN_LIMITS.agency.priorityMonitoringSlots ?? 0) === 25,
  'Agency priority slots = 25',
);

// --- Priority monitoring is agency-only ---
const proUser = { email: 'pro@test.com', plan: 'pro' as const, subscription_status: 'active' as const };
const growthUser = { email: 'growth@test.com', plan: 'growth' as const, subscription_status: 'active' as const };
const agencyUser = { email: 'agency@test.com', plan: 'agency' as const, subscription_status: 'active' as const };

check(!canUsePriorityMonitoring(proUser), 'Priority monitoring blocked for Pro');
check(!canUsePriorityMonitoring(growthUser), 'Priority monitoring blocked for Growth');
check(canUsePriorityMonitoring(agencyUser), 'Priority monitoring allowed for Agency');

// --- Free plan has no recurring monitoring ---
check(PLAN_LIMITS.free.scanFrequency === 'manual', 'Free plan scanFrequency = manual');
check(
  getPlanMarketing('free').monitoringLabel.toLowerCase().includes('no automated monitoring') ||
    getPlanMarketing('free').monitoringLabel.toLowerCase().includes('no recurring'),
  'Free plan marketing has no recurring monitoring',
);

// --- Core billing mirror ---
check(CORE_PLANS.pro.websiteLimit === 10, 'core/billing Pro website limit = 10');
check(CORE_PLANS.growth.websiteLimit === 50, 'core/billing Growth website limit = 50');
check(CORE_PLANS.agency.websiteLimit === 250, 'core/billing Agency website limit = 250');

// --- Marketing copy honesty ---
const allMarketingText = BILLED_PLANS.flatMap((plan) => {
  const m = PLAN_MARKETING[plan];
  return [m.tagline, m.monitoringLabel, m.deepScanLabel, m.websiteLabel, ...m.bullets];
}).join('\n');

check(!/unlimited websites/i.test(allMarketingText), 'Plan copy does not claim unlimited websites');

const proCopy = [
  PLAN_MARKETING.pro.monitoringLabel,
  ...PLAN_MARKETING.pro.bullets,
].join('\n');
check(!/hourly monitoring/i.test(proCopy), 'Pro copy does not claim hourly monitoring');
check(!/5-minute|5 minute/i.test(proCopy), 'Pro copy does not claim 5-minute monitoring');

const growthCopy = [
  PLAN_MARKETING.growth.monitoringLabel,
  ...PLAN_MARKETING.growth.bullets,
].join('\n');
check(!/5-minute|5 minute/i.test(growthCopy), 'Growth copy does not claim 5-minute monitoring');

for (const plan of ['pro', 'growth'] as const) {
  const copy = [PLAN_MARKETING[plan].tagline, ...PLAN_MARKETING[plan].bullets].join('\n');
  check(!/client reports/i.test(copy), `${plan} copy does not claim client reports`);
  check(!/proof-of-work|proof of work/i.test(copy), `${plan} copy does not claim proof-of-work exports`);
}

// --- manual deep scans/day terminology ---
check(
  formatDeepScanLimit(PLAN_LIMITS.pro.maxScansPerDay).includes('manual deep scans/day'),
  'Pro deep scan label uses manual deep scans/day',
);
check(
  formatDeepScanLimit(PLAN_LIMITS.growth.maxScansPerDay).includes('manual deep scans/day'),
  'Growth deep scan label uses manual deep scans/day',
);
check(
  PLAN_MARKETING.agency.bullets.some((b) => /manual deep scans\/day/i.test(b)),
  'Agency bullets mention manual deep scans/day',
);

// --- Agency client workflow remains agency-only ---
const agencyCopy = [
  PLAN_MARKETING.agency.tagline,
  ...PLAN_MARKETING.agency.bullets,
].join('\n');
check(/client-ready reports|multi-client dashboard/i.test(agencyCopy), 'Agency retains client workflow copy');
check(!/client-ready reports|multi-client dashboard/i.test(proCopy + growthCopy), 'Pro/Growth lack agency client workflow copy');

console.log('\nAll plan consistency checks passed.\n');
