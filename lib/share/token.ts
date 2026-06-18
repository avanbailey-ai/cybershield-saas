import { randomBytes } from 'crypto';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

/** Short URL-safe slug for public share links (12 hex chars). */
export function generateShareToken(): string {
  return randomBytes(6).toString('hex');
}

export function shareResultUrl(token: string, baseUrl?: string): string {
  const origin = baseUrl ?? resolveSiteUrl();
  return `${origin}/scan-result/${token}`;
}
