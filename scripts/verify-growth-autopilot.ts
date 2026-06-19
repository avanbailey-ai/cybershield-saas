/**
 * Growth autopilot verification.
 * Run: npx tsx scripts/verify-growth-autopilot.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_GROWTH_AUTOPILOT_SETTINGS,
  AUTOPILOT_MODE_LABELS,
} from '../lib/owner/growthAutopilotSettings';

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Growth autopilot verification\n');

assert(existsSync(join(process.cwd(), 'lib/owner/growthAutopilot.ts')), 'growthAutopilot module exists');
assert(existsSync(join(process.cwd(), 'lib/owner/growthAutopilotSettings.ts')), 'growthAutopilotSettings exists');
assert(existsSync(join(process.cwd(), 'app/api/cron/growth-autopilot/route.ts')), 'growth-autopilot cron route exists');

assert(DEFAULT_GROWTH_AUTOPILOT_SETTINGS.mode === 'manual', 'default mode is manual');
assert(DEFAULT_GROWTH_AUTOPILOT_SETTINGS.prepare_only === true, 'default prepare-only');
assert(DEFAULT_GROWTH_AUTOPILOT_SETTINGS.limited_autopilot_sending === false, 'limited send off by default');

assert(Object.keys(AUTOPILOT_MODE_LABELS).length === 4, 'four autopilot modes defined');

const cronRoute = read('app/api/cron/growth-autopilot/route.ts');
assert(cronRoute.includes('isWorkerAuthorized'), 'cron requires worker auth');
assert(cronRoute.includes('runGrowthAutopilot'), 'cron calls runGrowthAutopilot');

const growthSrc = read('lib/owner/growthAutopilot.ts');
assert(growthSrc.includes('prepareOnly'), 'runGrowthAutopilot tracks prepare-only');
assert(!/sendApprovedOutreach\(/.test(growthSrc), 'growth cron does not auto-send outreach');

assert(read('vercel.json').includes('/api/cron/growth-autopilot'), 'growth cron scheduled in vercel.json');
assert(read('lib/owner/founderOsV6.ts').includes('growthAutopilot'), 'V6 includes growth snapshot');
assert(read('components/owner/dashboard/GrowthCommandCenter.tsx').includes('While you slept'), 'Home shows overnight report');

assert(read('lib/owner/deliverabilityGuard.ts').includes('WARMUP_DAILY_CAPS'), 'warmup caps defined');
assert(read('lib/owner/deliverabilityGuard.ts').includes('max: 10'), 'week 1 cap max 10');
assert(read('lib/owner/conversionPathGuard.ts').includes('checkConversionPaths'), 'conversion guard exists');
assert(read('app/agency/page.tsx').length > 0 || existsSync(join(process.cwd(), 'app/agency/page.tsx')), 'agency page exists');
assert(read('app/summary/page.tsx').length > 0 || existsSync(join(process.cwd(), 'app/summary/page.tsx')), 'summary page exists');

assert(read('lib/owner/discovery/settings.ts').includes("'global'"), 'global discovery scope exists');

console.log('\nAll growth autopilot checks passed.');
