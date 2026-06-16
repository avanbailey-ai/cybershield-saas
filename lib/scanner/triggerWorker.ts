/**
 * @deprecated Scan jobs are processed by /api/scan/enqueue-or-process-batch (Vercel Cron).
 * Enqueue-only paths must NOT call this.
 */

export function triggerBackgroundQueueProcessing(_maxJobs = 5): void {
  console.warn(
    '[triggerWorker] DEPRECATED — scan jobs are processed by /api/scan/enqueue-or-process-batch (Vercel Cron).',
  );
}
