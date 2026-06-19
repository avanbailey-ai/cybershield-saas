import { OWNER_EMAIL } from '@/lib/auth/owner';

/**
 * Single source of truth for excluding internal / test / QA accounts from
 * founder business metrics (MRR, ARR, customers, trials, conversion, churn,
 * revenue at risk, expansion, customer health, activity feed, email intel).
 *
 * Prefer {@link isInternalCustomerProfile} at call sites — it also honors the
 * `profiles.is_qa_account` DB flag, which email patterns alone cannot detect.
 */

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'sharklasers.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'yopmail.com',
]);

/** Internal, test, or founder accounts by email pattern. */
export function isInternalCustomerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return true;
  const lower = email.trim().toLowerCase();
  if (lower === OWNER_EMAIL.toLowerCase()) return true;
  if (lower.includes('+stripe-preview-test')) return true;
  if (lower.includes('+test@')) return true;
  if (lower.includes('+test+')) return true;
  if (lower === 'test@gmail.com' || lower.startsWith('test+')) return true;
  if (lower.startsWith('qa+') || lower.includes('+qa@')) return true;
  const domain = lower.split('@')[1] ?? '';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  if (domain === 'example.com' || domain === 'test.com') return true;
  return false;
}

export interface InternalAccountProfile {
  email?: string | null;
  is_qa_account?: boolean | null;
  plan?: string | null;
}

/**
 * Authoritative exclusion check for a profile row. Excludes when:
 *  - the DB `is_qa_account` flag is set, OR
 *  - the plan is the internal `owner` plan, OR
 *  - the email matches an internal/test pattern.
 */
export function isInternalCustomerProfile(profile: InternalAccountProfile | null | undefined): boolean {
  if (!profile) return true;
  if (profile.is_qa_account === true) return true;
  if ((profile.plan ?? '').toLowerCase() === 'owner') return true;
  return isInternalCustomerEmail(profile.email);
}

/** Columns every metric query must select so QA accounts are excluded. */
export const INTERNAL_FILTER_PROFILE_COLUMNS = 'email, is_qa_account, plan' as const;

export function formatInactivityDays(days: number): string {
  if (days >= 365) return 'No login recorded';
  if (days > 60) return `No login for ${days} days`;
  return `No login for ${days} days`;
}
