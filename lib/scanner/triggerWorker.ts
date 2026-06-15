/**
 * Fire-and-forget queue worker trigger — keeps API routes non-blocking.
 */

import { processQueue } from './processQueue';

export function triggerBackgroundQueueProcessing(maxJobs = 5): void {
  void processQueue(maxJobs).catch((err) => {
    console.error('[triggerWorker] processQueue failed', err);
  });
}
