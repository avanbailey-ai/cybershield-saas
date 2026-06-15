/**
 * @deprecated Workers are invoked by /api/workers/process-scans (cron or external scheduler).
 * Enqueue-only paths must NOT call this — jobs are processed by the worker endpoint.
 */

export function triggerBackgroundQueueProcessing(_maxJobs = 5): void {
  console.warn(
    '[triggerWorker] DEPRECATED — scan jobs are processed by /api/workers/process-scans. ' +
      'Configure cron-job.org or Vercel cron to hit the worker endpoint.',
  );
}
