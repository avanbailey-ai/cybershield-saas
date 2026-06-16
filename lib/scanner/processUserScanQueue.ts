/**
 * Process pending scan jobs from authenticated user flows (not cron).
 * Must be awaited (or scheduled via next/after) — fire-and-forget is killed on serverless.
 */

import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { getScanBatchLimit } from '@/lib/queue/constants';

export type ProcessUserScanQueueOptions = {
  /** Max jobs to claim in this invocation (default 1 for single-site actions). */
  batchLimit?: number;
};

/**
 * Claim and run pending scan jobs. Safe to call from POST /api/websites, /api/scan, etc.
 */
export async function processQueuedScansForUser(options?: ProcessUserScanQueueOptions) {
  const batchLimit = Math.min(
    Math.max(1, options?.batchLimit ?? 1),
    getScanBatchLimit(),
  );
  return handleScanBatch(batchLimit);
}

/** @deprecated alias — prefer processQueuedScansForUser */
export const processQueuedScansForOrg = processQueuedScansForUser;
