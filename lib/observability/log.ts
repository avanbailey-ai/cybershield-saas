/** Structured JSON logging + optional analytics_events persistence. */

import { createAdminClient } from '@/lib/supabase/admin';

export function logRequest(route: string, durationMs: number, status: number): void {
  console.log(
    JSON.stringify({ type: 'request', route, durationMs, status, ts: new Date().toISOString() }),
  );
}

export function logScanTiming(scanId: string, durationMs: number): void {
  console.log(
    JSON.stringify({ type: 'scan_timing', scanId, durationMs, ts: new Date().toISOString() }),
  );
}

export function logWebhookFailure(event: string, error: unknown): void {
  console.error(
    JSON.stringify({
      type: 'webhook_failure',
      event,
      error: error instanceof Error ? error.message : String(error),
      ts: new Date().toISOString(),
    }),
  );
}

export function logApiTiming(
  route: string,
  durationMs: number,
  status: number,
  metadata?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      type: 'api_timing',
      route,
      durationMs,
      status,
      ...metadata,
      ts: new Date().toISOString(),
    }),
  );
}

export function logCheckoutLatency(durationMs: number, status: number, userId?: string): void {
  logApiTiming('/api/stripe/checkout', durationMs, status, { userId });
}

export function logWebhookProcessing(eventType: string, durationMs: number): void {
  console.log(
    JSON.stringify({
      type: 'webhook_timing',
      eventType,
      durationMs,
      ts: new Date().toISOString(),
    }),
  );
}

/** Non-blocking performance event — stored in analytics_events when available. */
export function recordPerformanceEvent(
  eventType: string,
  metadata: Record<string, unknown>,
  userId?: string | null,
): void {
  void (async () => {
    try {
      const admin = createAdminClient();
      await admin.from('analytics_events').insert({
        event_type: eventType,
        user_id: userId ?? null,
        metadata,
      });
    } catch {
      // Non-fatal — table may not exist in all environments
    }
  })();
}
