import { normalizeDomain } from '@/lib/cache/scanCache';

/** Max distinct domains a session may scan per UTC day (free public tier). */
export const MAX_PUBLIC_DOMAINS_PER_SESSION_PER_DAY = 3;
/** Max scans per domain per UTC day — free public tier is one scan per website. */
export const MAX_PUBLIC_SCANS_PER_DOMAIN_PER_DAY = 1;
/** Max total scans per IP per UTC day (abuse guard). */
export const MAX_PUBLIC_SCANS_PER_IP_PER_DAY = 5;

interface DomainCounts {
  date: string;
  domains: Map<string, number>;
  total: number;
}

const sessionLimits = new Map<string, DomainCounts>();
const ipLimits = new Map<string, DomainCounts>();

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getOrReset(map: Map<string, DomainCounts>, key: string): DomainCounts {
  const today = todayKey();
  const entry = map.get(key);
  if (!entry || entry.date !== today) {
    const fresh = { date: today, domains: new Map<string, number>(), total: 0 };
    map.set(key, fresh);
    return fresh;
  }
  return entry;
}

export type PublicScanLimitReason = 'no_session' | 'domain_limit' | 'session_limit' | 'ip_limit';

export function checkPublicScanLimit(
  sessionId: string | null,
  clientIp: string,
  url: string,
): { allowed: boolean; reason?: PublicScanLimitReason; message?: string } {
  if (!sessionId || sessionId === 'anon') {
    return {
      allowed: false,
      reason: 'no_session',
      message: 'A scan session is required. Please refresh and try again.',
    };
  }

  const domain = normalizeDomain(url);
  const sessionEntry = getOrReset(sessionLimits, sessionId);
  const ipEntry = getOrReset(ipLimits, clientIp);

  const domainCount = sessionEntry.domains.get(domain) ?? 0;
  if (domainCount >= MAX_PUBLIC_SCANS_PER_DOMAIN_PER_DAY) {
    return {
      allowed: false,
      reason: 'domain_limit',
      message: `You've already scanned ${domain} today. Upgrade for unlimited monitoring.`,
    };
  }

  if (sessionEntry.total >= MAX_PUBLIC_DOMAINS_PER_SESSION_PER_DAY) {
    return {
      allowed: false,
      reason: 'session_limit',
      message: `Daily free scan limit reached (${MAX_PUBLIC_DOMAINS_PER_SESSION_PER_DAY} websites/day). Upgrade for unlimited monitoring.`,
    };
  }

  if (ipEntry.total >= MAX_PUBLIC_SCANS_PER_IP_PER_DAY) {
    return {
      allowed: false,
      reason: 'ip_limit',
      message: 'Too many scan requests from your network today. Please try again tomorrow.',
    };
  }

  return { allowed: true };
}

/** Record a successful public scan against session + IP counters. */
export function recordPublicScanLimit(sessionId: string, clientIp: string, url: string): void {
  const domain = normalizeDomain(url);
  const sessionEntry = getOrReset(sessionLimits, sessionId);
  const ipEntry = getOrReset(ipLimits, clientIp);

  sessionEntry.domains.set(domain, (sessionEntry.domains.get(domain) ?? 0) + 1);
  sessionEntry.total += 1;
  ipEntry.domains.set(domain, (ipEntry.domains.get(domain) ?? 0) + 1);
  ipEntry.total += 1;
}

/** @deprecated Use checkPublicScanLimit — kept for callers expecting old shape. */
export function checkAndIncrementServerScanLimit(sessionId: string | null): {
  allowed: boolean;
  count: number;
} {
  if (!sessionId) return { allowed: false, count: 0 };
  const entry = getOrReset(sessionLimits, sessionId);
  return {
    allowed: entry.total < MAX_PUBLIC_DOMAINS_PER_SESSION_PER_DAY,
    count: entry.total,
  };
}
