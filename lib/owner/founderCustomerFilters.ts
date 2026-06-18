import { OWNER_EMAIL } from '@/lib/auth/owner';

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'sharklasers.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'yopmail.com',
]);

/** Internal, test, or founder accounts — exclude from customer health / revenue metrics. */
export function isInternalCustomerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return true;
  const lower = email.trim().toLowerCase();
  if (lower === OWNER_EMAIL.toLowerCase()) return true;
  if (lower.includes('+stripe-preview-test')) return true;
  if (lower.includes('+test@')) return true;
  if (lower === 'test@gmail.com' || lower.startsWith('test+')) return true;
  const domain = lower.split('@')[1] ?? '';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  return false;
}

export function formatInactivityDays(days: number): string {
  if (days >= 365) return 'No login recorded';
  if (days > 60) return `No login for ${days} days`;
  return `No login for ${days} days`;
}
