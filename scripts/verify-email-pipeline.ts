/**
 * Unit tests for email budget + decision rules (no DB).
 * Run: npx tsx scripts/verify-email-pipeline.ts
 */

import {
  getBudgetTier,
  isCategoryAllowedAtTier,
  EMAIL_BUDGET,
} from '../lib/alerts/emailTypes';
import {
  shouldEmailImmediately,
  immediateSkipReasonForSeverity,
  planAllowsMonitoringEmail,
  buildFindingKey,
  isCriticalRepeatCooldownActive,
} from '../lib/alerts/emailDecision';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(getBudgetTier(2000) === 'normal', 'Under 2400 is normal');
assert(getBudgetTier(2500) === 'warning', '2400-2800 is warning');
assert(getBudgetTier(2900) === 'restricted', '2800-2950 is restricted');
assert(getBudgetTier(2960) === 'hard_stop', 'Above 2950 is hard_stop');
assert(getBudgetTier(3000) === 'exhausted', 'At 3000 is exhausted');

assert(isCategoryAllowedAtTier('marketing_onboarding', 'warning') === false, 'No marketing at warning');
assert(isCategoryAllowedAtTier('critical_alert', 'hard_stop') === true, 'Critical at hard_stop');
assert(isCategoryAllowedAtTier('weekly_digest', 'hard_stop') === false, 'No weekly at hard_stop');
assert(
  isCategoryAllowedAtTier('account_system', 'exhausted') === true,
  'Account system always at exhausted',
);

assert(
  shouldEmailImmediately({
    eventType: 'ssl_changed',
    severity: 'critical',
    findingTitle: 'No HTTPS',
    currentSeverity: 'critical',
    isNew: true,
    isWorsened: false,
  }),
  'New critical SSL is immediate',
);

assert(
  !shouldEmailImmediately({
    eventType: 'security_issue',
    severity: 'medium',
    findingTitle: 'Missing CSP',
    currentSeverity: 'medium',
    isNew: true,
    isWorsened: false,
  }),
  'Medium is not immediate',
);

assert(immediateSkipReasonForSeverity('high') === 'high_weekly_digest_only', 'High goes to digest');
assert(immediateSkipReasonForSeverity('medium') === 'severity_digest_only', 'Medium dashboard/digest');

assert(!planAllowsMonitoringEmail('free'), 'Free has no monitoring emails');
assert(planAllowsMonitoringEmail('pro'), 'Pro has monitoring emails');

assert(
  buildFindingKey('security_issue', '[LOW] Third-Party Script').includes('third_party'),
  'Finding keys normalize bracket prefixes',
);

const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
assert(!isCriticalRepeatCooldownActive(eightDaysAgo), '8 days ago cooldown expired');
assert(isCriticalRepeatCooldownActive(twoDaysAgo), '2 days ago still in 7d cooldown');

assert(EMAIL_BUDGET.monthlyEmailBudget === 3000, 'Budget is 3000/month');
assert(EMAIL_BUDGET.dailyHardLimit === 100, 'Daily hard limit 100');

console.log('All email pipeline checks passed.');
