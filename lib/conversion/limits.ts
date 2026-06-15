const SCANS_KEY = 'cybershield_scans_today';
const DOMAINS_KEY = 'cybershield_scanned_domains';
const SESSION_ID_KEY = 'cybershield_scan_session_id';
const LAST_DOMAIN_KEY = 'cybershield_last_domain';
const UPGRADE_MODAL_SHOWN_KEY = 'cybershield_upgrade_modal_shown';

/** Max distinct domains per session per UTC day (matches server). */
export const MAX_PUBLIC_SCANS_PER_DAY = 3;
/** One scan per website on the free public tier. */
export const MAX_PUBLIC_SCANS_PER_DOMAIN_PER_DAY = 1;

interface ScanDayRecord {
  date: string;
  count: number;
  domains: string[];
  lastDomain?: string;
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function readRecord(): ScanDayRecord {
  if (typeof window === 'undefined') {
    return { date: todayKey(), count: 0, domains: [] };
  }
  try {
    const raw = sessionStorage.getItem(SCANS_KEY);
    if (!raw) return { date: todayKey(), count: 0, domains: [] };
    const parsed = JSON.parse(raw) as ScanDayRecord;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0, domains: [] };
    }
    return { ...parsed, domains: parsed.domains ?? [] };
  } catch {
    return { date: todayKey(), count: 0, domains: [] };
  }
}

function writeRecord(record: ScanDayRecord): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SCANS_KEY, JSON.stringify(record));
}

export function getOrCreateScanSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function getPublicScanCount(): number {
  return readRecord().count;
}

export function getLastScannedDomain(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(LAST_DOMAIN_KEY);
}

export function setLastScannedDomain(domain: string): void {
  if (typeof window === 'undefined') return;
  try {
    const hostname = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname;
    sessionStorage.setItem(LAST_DOMAIN_KEY, hostname);
  } catch {
    sessionStorage.setItem(LAST_DOMAIN_KEY, domain);
  }
}

function normalizeHostname(url: string): string {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function canRunPublicScan(url?: string): {
  allowed: boolean;
  count: number;
  remaining: number;
  domainAlreadyScanned?: boolean;
} {
  const record = readRecord();
  const hostname = url ? normalizeHostname(url) : null;

  if (hostname && record.domains.includes(hostname)) {
    return {
      allowed: false,
      count: record.count,
      remaining: 0,
      domainAlreadyScanned: true,
    };
  }

  const remaining = Math.max(0, MAX_PUBLIC_SCANS_PER_DAY - record.count);
  return {
    allowed: record.count < MAX_PUBLIC_SCANS_PER_DAY,
    count: record.count,
    remaining,
  };
}

/** Call after a successful scan response. Returns whether this was the 2nd scan today. */
export function recordPublicScan(domain: string): { scanCount: number; isSecondScan: boolean } {
  const record = readRecord();
  const hostname = normalizeHostname(domain);
  const domains = record.domains.includes(hostname)
    ? record.domains
    : [...record.domains, hostname];
  const nextCount = domains.length;
  writeRecord({
    date: todayKey(),
    count: nextCount,
    domains,
    lastDomain: hostname,
  });
  setLastScannedDomain(domain);
  return {
    scanCount: nextCount,
    isSecondScan: nextCount === 2,
  };
}

/** Prevent stacking upgrade modals within a session. */
export function markUpgradeModalShown(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(UPGRADE_MODAL_SHOWN_KEY, '1');
}

export function wasUpgradeModalShownThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(UPGRADE_MODAL_SHOWN_KEY) === '1';
}
