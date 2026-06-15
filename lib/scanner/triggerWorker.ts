/**
 * @deprecated Workers are invoked by /api/scan/enqueue-or-process-batch (cron-job.org).
 * Enqueue-only paths must NOT call this — jobs are processed by the worker endpoint.
 */

export function triggerBackgroundQueueProcessing(_maxJobs = 5): void {
  console.warn(
    '[triggerWorker] DEPRECATED — scan jobs are processed by /api/scan/enqueue-or-process-batch. ' +
      'Configure cron-job.org (every 5 min) with Authorization: Bearer CRON_SECRET.',
  );
}
