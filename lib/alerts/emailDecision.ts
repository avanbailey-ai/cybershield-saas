import type { Plan } from '@/lib/billing/plans';

export interface AlertEventInput {
  eventType: string;
  severity: string;
  findingTitle: string;
  previousSeverity?: string | null;
  currentSeverity: string;
  previousScore?: number | null;
  currentScore?: number | null;
  isNew: boolean;
  isWorsened: boolean;
}

const CRITICAL_IMMEDIATE_TYPES = new Set([
  'ssl_changed',
  'security_score_drop',
  'header_removed',
  'risk_increase',
  'change_detected',
  'security_issue',
]);

const SCORE_DROP_IMMEDIATE_MIN = 15;
const CRITICAL_REPEAT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function buildFindingKey(eventType: string, findingTitle: string): string {
  const normalized = findingTitle
    .toLowerCase()
    .replace(/^\[(critical|high|medium|low)\]\s*/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 80);
  return `${eventType}:${normalized}`;
}

export function shouldEmailImmediately(input: AlertEventInput): boolean {
  const severity = input.currentSeverity;

  if (input.isNew && severity === 'critical') return true;
  if (input.isWorsened && severity === 'critical') return true;

  if (input.eventType === 'ssl_changed' && severity === 'critical') return true;

  if (input.eventType === 'security_score_drop') {
    if (severity === 'critical') return true;
    if (
      severity === 'high' &&
      input.previousScore !== null &&
      input.previousScore !== undefined &&
      input.currentScore !== null &&
      input.currentScore !== undefined &&
      input.previousScore - input.currentScore >= SCORE_DROP_IMMEDIATE_MIN
    ) {
      return true;
    }
  }

  if (input.eventType === 'header_removed' && severity === 'critical') return true;
  if (input.eventType === 'risk_increase' && severity === 'critical') return true;

  if (CRITICAL_IMMEDIATE_TYPES.has(input.eventType) && severity === 'critical' && input.isNew) {
    return true;
  }

  return false;
}

export function isDigestEligible(severity: string, shouldImmediate: boolean): boolean {
  if (shouldImmediate) return false;
  return severity === 'high' || severity === 'medium' || severity === 'low' || severity === 'critical';
}

export function planAllowsMonitoringEmail(plan: Plan): boolean {
  return plan !== 'free';
}

export function planAllowsWeeklyDigest(plan: Plan): boolean {
  return plan === 'pro' || plan === 'growth' || plan === 'agency' || plan === 'owner';
}

export function planAllowsMonthlyReport(plan: Plan): boolean {
  return planAllowsWeeklyDigest(plan);
}

export function isCriticalRepeatCooldownActive(lastEmailedAt: string | null): boolean {
  if (!lastEmailedAt) return false;
  return Date.now() - new Date(lastEmailedAt).getTime() < CRITICAL_REPEAT_COOLDOWN_MS;
}

export function immediateSkipReasonForSeverity(severity: string): string | null {
  if (severity === 'medium' || severity === 'low') return 'severity_digest_only';
  if (severity === 'high') return 'high_weekly_digest_only';
  return null;
}
