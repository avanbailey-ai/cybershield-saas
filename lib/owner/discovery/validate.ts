import dns from 'dns/promises';

export async function validateDns(hostname: string): Promise<boolean> {
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
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CyberShield-ProspectDiscovery/1.0' },
    });
    return res.status > 0 && res.status < 500;
  } catch {
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'CyberShield-ProspectDiscovery/1.0' },
      });
      return res.status > 0 && res.status < 500;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function validateProspectWebsite(url: string): Promise<{ dns_valid: boolean; http_valid: boolean }> {
  const host = new URL(url).hostname;
  const dns_valid = await validateDns(host);
  const http_valid = dns_valid ? await validateHttp(url) : false;
  return { dns_valid, http_valid };
}
