export function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    let url = trimmed;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const parsed = new URL(url);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export function websiteHostKey(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function nameFromWebsite(url: string): string {
  const host = websiteHostKey(url);
  return host.replace(/^www\./, '').split('.')[0] ?? host;
}
