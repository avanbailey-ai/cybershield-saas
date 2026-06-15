/** Shared queue worker tuning — safe for multi-instance deployments. */

export const STALE_LOCK_MINUTES = 10;
export const SCAN_BATCH_SIZE = 10;
export const MAX_SCAN_BATCH = 10;
export const EMAIL_BATCH_SIZE = 20;
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default per-job scan timeout (ms). Override via SCAN_JOB_TIMEOUT_MS. */
export const DEFAULT_SCAN_JOB_TIMEOUT_MS = 120_000;

const MIN_WORKER_CONCURRENCY = 1;
const MAX_WORKER_CONCURRENCY = 3;
export const DEFAULT_WORKER_CONCURRENCY = 3;

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

/** Worker concurrency per invocation — clamped to 1–3 for production safety. */
export function getWorkerConcurrency(): number {
  const raw = process.env.SCAN_WORKER_CONCURRENCY;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.max(parsed, MIN_WORKER_CONCURRENCY), MAX_WORKER_CONCURRENCY);
    }
  }
  return DEFAULT_WORKER_CONCURRENCY;
}

export function getScanJobTimeoutMs(): number {
  const raw = process.env.SCAN_JOB_TIMEOUT_MS;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_SCAN_JOB_TIMEOUT_MS;
}

/** @deprecated Use getWorkerConcurrency() — kept for imports that expect a constant. */
export const WORKER_CONCURRENCY = DEFAULT_WORKER_CONCURRENCY;
