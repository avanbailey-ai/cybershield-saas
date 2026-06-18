/**
 * Verifies lightweight vs deep scan execution routing (Phase 2A).
 * Run: npx tsx scripts/verify-monitoring-execution.ts
 */

import { resolveScanExecutionKind, LIGHTWEIGHT_CHANGE_TYPES } from '../lib/scanner/scanTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(
  resolveScanExecutionKind('monitoring_check', 'cron') === 'monitoring_check',
  'cron monitoring_check',
);
assert(resolveScanExecutionKind('deep_scan', 'cron') === 'deep_scan', 'cron deep_scan');
assert(
  resolveScanExecutionKind(null, 'manual') === 'deep_scan',
  'manual defaults deep',
);
assert(
  resolveScanExecutionKind(undefined, 'cron') === 'monitoring_check',
  'cron without kind -> monitoring',
);

assert(LIGHTWEIGHT_CHANGE_TYPES.has('ssl_changed'), 'ssl in lightweight changes');
assert(LIGHTWEIGHT_CHANGE_TYPES.has('security_header_changed'), 'headers in lightweight');
assert(!LIGHTWEIGHT_CHANGE_TYPES.has('script_added'), 'scripts excluded');

console.log('All monitoring execution checks passed.');
