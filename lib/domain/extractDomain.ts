/** Hostname from URL (e.g. www.example.com). */
export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Strip www. prefix from hostname. */
export function stripWww(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Best-effort registrable domain for RDAP lookup.
 * Handles common cases (example.com, www.example.com, app.example.com).
 * Does not use a public suffix list — co.uk-style domains may need manual review.
 */
export function extractRegistrableDomain(url: string): string | null {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return null;

  const host = stripWww(hostname);
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}
