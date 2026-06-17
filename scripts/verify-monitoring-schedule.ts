/**
 * Verifies plan-based monitoring intervals and grouped alert rules (no DB required).
 * Run: npx tsx scripts/verify-monitoring-schedule.ts
 */

import {
  getEligibleFrequencyMinutes,
  isDueForScheduledScan,
  resolveScanModeForWebsite,
} from '../lib/jobs/scanFrequency';
import { shouldQueueAlertEmail, isUnderAttackAlert, isBatchUnderAttack } from '../lib/alerts/alertEmailRules';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = Date.now();

// Free — no recurring monitoring
assert(
  !isDueForScheduledScan('free', {
    nextScanAt: null,
    lastScannedAt: null,
    scanFrequency: 'daily_scan',
    monitoringEnabled: true,
  }),
  'Free plan must not be due for scheduled scans',
);

// Pro — 24h cadence (1440 min)
const proMode = resolveScanModeForWebsite('pro', 'daily_scan', false);
assert(proMode === 'daily_scan', 'Pro default mode is daily_scan');
assert(
  getEligibleFrequencyMinutes('pro', 'daily_scan', false) === 1440,
  'Pro quick monitoring is every 24 hours',
);

// Growth — 1h cadence
assert(
  getEligibleFrequencyMinutes('growth', 'daily_scan', false) === 60,
  'Growth quick monitoring is hourly',
);

// Agency priority — 5 min
assert(
  getEligibleFrequencyMinutes('agency', 'hourly_monitor', true) === 5,
  'Agency priority monitoring is every 5 minutes',
);

// Agency non-priority — hourly (not 5 min)
assert(
  getEligibleFrequencyMinutes('agency', 'daily_scan', false) === 60,
  'Agency non-priority monitoring is hourly',
);

// Pro not due when next_scan_at is in the future
assert(
  !isDueForScheduledScan('pro', {
    nextScanAt: new Date(now + 60 * 60 * 1000).toISOString(),
    lastScannedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    scanFrequency: 'daily_scan',
    monitoringEnabled: true,
  }),
  'Pro website is not due when next_scan_at is in the future',
);

// Email severity gating
assert(shouldQueueAlertEmail('critical'), 'Critical alerts queue for email');
assert(shouldQueueAlertEmail('high'), 'High alerts queue for email');
assert(!shouldQueueAlertEmail('medium'), 'Medium alerts are dashboard-only');
assert(!shouldQueueAlertEmail('low'), 'Low alerts are dashboard-only');

// Under-attack bypass signals
assert(
  isUnderAttackAlert({ severity: 'critical', type: 'ssl_changed' }),
  'Critical SSL/HTTPS loss is under attack',
);
assert(
  isUnderAttackAlert({ severity: 'high', type: 'security_score_drop', message: 'Score decreased (−18 points)' }),
  'High score drop ≥15 is under attack',
);
assert(
  !isUnderAttackAlert({ severity: 'high', type: 'security_issue' }),
  'Generic high security issue is not under attack alone',
);
assert(
  isBatchUnderAttack([
    { severity: 'critical', type: 'security_issue', website_id: 'a' },
    { severity: 'critical', type: 'security_issue', website_id: 'b' },
  ]),
  'Two critical alerts in batch triggers under attack',
);
assert(
  isBatchUnderAttack([{ severity: 'high', type: 'risk_increase' }]),
  'Risk increase triggers under attack via alert-level signal',
);
assert(
  !isBatchUnderAttack([{ severity: 'high', type: 'security_issue' }]),
  'Single generic high alert does not trigger batch under attack',
);

console.log('All monitoring schedule checks passed.');
