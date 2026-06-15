/**
 * Domain metrics — thin wrappers over recordMetric.
 */

import { recordMetric } from './index';

export async function recordScanDuration(
  ms: number,
  dims: { priority?: number; success: boolean },
): Promise<void> {
  await recordMetric('scan_duration_ms', ms, {
    priority: dims.priority ?? null,
    success: dims.success,
  });
}

export async function recordQueueDepth(
  depth: number,
  dims?: { priority?: number },
): Promise<void> {
  await recordMetric('queue_depth', depth, {
    priority: dims?.priority ?? null,
  });
}

export async function recordApiLatency(
  route: string,
  ms: number,
  status: number,
): Promise<void> {
  await recordMetric('api_latency_ms', ms, { route, status });
}

export async function recordWebhookResult(success: boolean): Promise<void> {
  await recordMetric('webhook_result', success ? 1 : 0, { success });
}
