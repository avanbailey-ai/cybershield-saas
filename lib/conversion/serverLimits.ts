import { MAX_PUBLIC_SCANS_PER_DAY } from './limits';

interface DayCount {
  date: string;
  count: number;
}

const scanCounts = new Map<string, DayCount>();

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function checkAndIncrementServerScanLimit(sessionId: string | null): {
  allowed: boolean;
  count: number;
} {
  if (!sessionId) {
    return { allowed: true, count: 0 };
  }

  const today = todayKey();
  const entry = scanCounts.get(sessionId);

  if (!entry || entry.date !== today) {
    scanCounts.set(sessionId, { date: today, count: 1 });
    return { allowed: true, count: 1 };
  }

  if (entry.count >= MAX_PUBLIC_SCANS_PER_DAY) {
    return { allowed: false, count: entry.count };
  }

  entry.count += 1;
  return { allowed: true, count: entry.count };
}
