import dns from 'dns/promises';
import { websiteHostKey } from './normalize';

const REJECTED_HOST_PATTERNS = [
  /^example\.(com|org|net)$/i,
  /^localhost$/i,
  /\.example-/i,
  /\.test$/i,
  /^test\./i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
];

export function isRejectedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (!host || !host.includes('.')) return true;
  if (host.endsWith('.local')) return true;
  return REJECTED_HOST_PATTERNS.some((re) => re.test(host));
}

export function isRejectedWebsite(url: string): boolean {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return isRejectedHostname(host);
  } catch {
    return true;
  }
}

export async function validateDns(hostname: string): Promise<boolean> {
  if (isRejectedHostname(hostname)) return false;
  try {
    await dns.lookup(hostname);
    return true;
  } catch {
    return false;
  }
}

export async function validateHttp(url: string, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'User-Agent': 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com' };
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    return res.status > 0 && res.status < 500;
  } catch {
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers,
      });
      return res.status > 0 && res.status < 500;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function validateProspectWebsite(
  url: string,
): Promise<{ dns_valid: boolean; http_valid: boolean; rejected: boolean }> {
  if (isRejectedWebsite(url)) {
    return { dns_valid: false, http_valid: false, rejected: true };
  }
  const host = new URL(url).hostname;
  const dns_valid = await validateDns(host);
  const http_valid = dns_valid ? await validateHttp(url) : false;
  return { dns_valid, http_valid, rejected: false };
}

export function isDuplicateHost(host: string, existing: Set<string>): boolean {
  return existing.has(websiteHostKey(host));
}
