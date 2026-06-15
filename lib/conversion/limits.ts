const SCANS_KEY = 'cybershield_scans_today';
const SESSION_ID_KEY = 'cybershield_scan_session_id';
const LAST_DOMAIN_KEY = 'cybershield_last_domain';
export const MAX_PUBLIC_SCANS_PER_DAY = 3;

interface ScanDayRecord {
  date: string;
  count: number;
  lastDomain?: string;
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function readRecord(): ScanDayRecord {
  if (typeof window === 'undefined') {
    return { date: todayKey(), count: 0 };
  }
  try {
    const raw = sessionStorage.getItem(SCANS_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as ScanDayRecord;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
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

export function canRunPublicScan(): { allowed: boolean; count: number; remaining: number } {
  const record = readRecord();
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
  const nextCount = record.count + 1;
  writeRecord({
    date: todayKey(),
    count: nextCount,
    lastDomain: domain,
  });
  setLastScannedDomain(domain);
  return {
    scanCount: nextCount,
    isSecondScan: nextCount === 2,
  };
}
