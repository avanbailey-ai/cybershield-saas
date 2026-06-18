/**
 * Verify Website Health Center helpers.
 * Run: npx tsx scripts/verify-website-health-center.ts
 */

import {
  uptimeStatusFromHttp,
  uptimeStatusLabel,
  securityScoreLabel,
  securityScoreBadgeClass,
  scanKindLabel,
  monitoringEnabledLabel,
  domainStatusLabel,
  domainExpirySummary,
  sslExpirySummary,
} from '../lib/websiteHealth/healthStatus';
import { sslHealthFromDays } from '../lib/ssl/sslStatus';
import { domainHealthFromDays } from '../lib/domain/domainStatus';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(uptimeStatusFromHttp(200) === 'online', '200 online');
assert(uptimeStatusFromHttp(404) === 'degraded', '404 degraded');
assert(uptimeStatusFromHttp(503) === 'offline', '503 offline');
assert(uptimeStatusFromHttp(null) === 'unknown', 'null unknown');
assert(uptimeStatusFromHttp(null, true) === 'offline', 'failed scan offline');

assert(uptimeStatusLabel('online') === 'Online', 'online label');
assert(uptimeStatusLabel('pending') === 'Monitoring pending', 'pending label');
assert(securityScoreLabel(95) === 'Excellent', '95 excellent');
assert(securityScoreLabel(null) === 'Not scanned', 'null not scanned');
assert(securityScoreBadgeClass(95).includes('green'), '95 green badge');
assert(scanKindLabel('monitoring_check') === 'Lightweight check', 'monitoring label');
assert(scanKindLabel('deep_scan') === 'Full security scan', 'deep scan label');
assert(monitoringEnabledLabel(true) === 'Active', 'active monitoring');
assert(domainStatusLabel('healthy') === 'Healthy', 'domain healthy label');
assert(domainStatusLabel('unknown') === 'Unknown', 'domain unknown label');
assert(domainExpirySummary(45, domainHealthFromDays(45)) === '45 days until domain expiry', '45 days domain summary');
assert(domainExpirySummary(null, 'unknown') === 'Not checked yet', 'domain unknown summary');

assert(sslExpirySummary(14, sslHealthFromDays(14)) === '14 days until expiry', '14 days summary');
assert(sslExpirySummary(90, sslHealthFromDays(90)) === 'All monitored certificates healthy', 'healthy ssl summary');
assert(sslExpirySummary(null, 'unknown') === 'Not checked yet', 'ssl unknown');

console.log('All Website Health Center checks passed.');
