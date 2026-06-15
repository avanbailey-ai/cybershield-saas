import { randomBytes } from 'crypto';

/** Short URL-safe slug for public share links (12 hex chars). */
export function generateShareToken(): string {
  return randomBytes(6).toString('hex');
}

export function shareResultUrl(token: string, baseUrl?: string): string {
  const origin =
    baseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    '';
  return `${origin}/scan-result/${token}`;
}
