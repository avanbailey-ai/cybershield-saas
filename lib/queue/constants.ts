/** Shared queue worker tuning — safe for multi-instance deployments. */

export const STALE_LOCK_MINUTES = 10;
export const SCAN_BATCH_SIZE = 10;
export const MAX_SCAN_BATCH = 10;
export const EMAIL_BATCH_SIZE = 20;
export const WORKER_CONCURRENCY = 4;
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Bounded batch size for cron workers (default 10, capped at MAX_SCAN_BATCH). */
export function getScanBatchLimit(): number {
  const raw = process.env.SCAN_BATCH_LIMIT;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, MAX_SCAN_BATCH);
    }
  }
  return SCAN_BATCH_SIZE;
}
