/** Normalize a website URL to a stable host key for org-scoped duplicate detection. */
export function normalizeWebsiteHost(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Invalid URL format');
  }

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }

  return host;
}

/** Canonical stored URL (https + host, no trailing slash on root). */
export function normalizeWebsiteUrlForStorage(input: string): string {
  const host = normalizeWebsiteHost(input);
  return `https://${host}/`;
}
