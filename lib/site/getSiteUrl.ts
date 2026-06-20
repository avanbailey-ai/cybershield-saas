/**
 * Canonical site URL for Stripe return URLs, auth redirects, and emails.
 *
 * Production: https://www.cybershieldcloud.com (Vercel alias → cybershield-saas-1o19).
 * Every production deploy to that project automatically serves the .com domain.
 */
export const PRODUCTION_SITE_URL = 'https://www.cybershieldcloud.com';

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
    return PRODUCTION_SITE_URL;
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

/** Prefer env-aware URL; fall back to production .com when unset. */
export function resolveSiteUrl(): string {
  return getSiteUrl() || PRODUCTION_SITE_URL;
}
