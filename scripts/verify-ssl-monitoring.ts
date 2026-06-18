/**
 * Verify SSL monitoring helpers.
 * Run: npx tsx scripts/verify-ssl-monitoring.ts
 */

import {
  sslHealthFromDays,
  crossedExpiryThresholds,
  severityForExpiryThreshold,
} from '../lib/ssl/sslStatus';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(sslHealthFromDays(45) === 'healthy', '45 days healthy');
assert(sslHealthFromDays(20) === 'warning', '20 days warning');
assert(sslHealthFromDays(5) === 'critical', '5 days critical');
assert(sslHealthFromDays(0) === 'critical', 'expired critical');
assert(sslHealthFromDays(null) === 'unknown', 'null unknown');

assert(crossedExpiryThresholds(25).join(',') === '30', '25 crosses 30 only');
assert(crossedExpiryThresholds(3).join(',') === '3', '3 crosses most urgent 3 only');
assert(crossedExpiryThresholds(2).join(',') === '3', '2 days crosses 3 only');
assert(crossedExpiryThresholds(-1).includes(0), 'expired includes 0');

assert(severityForExpiryThreshold(0) === 'critical', '0 critical');
assert(severityForExpiryThreshold(14) === 'medium', '14 medium');

console.log('All SSL monitoring checks passed.');
