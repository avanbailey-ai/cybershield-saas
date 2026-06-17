/**
 * Canonical site URL for Stripe return URLs and emails.
 * In production, avoid Vercel preview deployment hashes in NEXT_PUBLIC_SITE_URL.
 */
const PRODUCTION_CANONICAL_URL = 'https://cybershield-saas-1o19.vercel.app';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isPreviewDeploymentUrl(url: string): boolean {
  return /-[\w]+-[\w]+s-projects\.vercel\.app/i.test(url);
}

export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    '';

  if (process.env.VERCEL_ENV === 'production') {
    if (configured && !isPreviewDeploymentUrl(configured)) {
      return stripTrailingSlash(configured);
    }
    return PRODUCTION_CANONICAL_URL;
  }

  if (configured) {
    return stripTrailingSlash(configured);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}`;
  }

  return '';
}
