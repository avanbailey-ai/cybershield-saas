/** Derive hostname from a website URL for queue domain column. */

export function domainFromUrl(url: string): string {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}
