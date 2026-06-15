/** Shared queue worker tuning — safe for multi-instance deployments. */

export const STALE_LOCK_MINUTES = 10;
export const SCAN_BATCH_SIZE = 10;
export const EMAIL_BATCH_SIZE = 20;
export const WORKER_CONCURRENCY = 4;
export const DEFAULT_MAX_ATTEMPTS = 3;
