/**
 * Observability service — structured logs, traces, and metrics (server-only).
 * All functions are non-throwing; failures are logged and swallowed.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type ObservabilityLayer =
  | 'auth'
  | 'billing'
  | 'scan'
  | 'queue'
  | 'worker'
  | 'ui'
  | 'api';

export type EventType =
  | 'scan_created'
  | 'scan_enqueued'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'stripe_webhook_received'
  | 'subscription_updated'
  | 'queue_retry_triggered';

export type TraceStatus = 'started' | 'completed' | 'failed';

export interface LogEventParams {
  type: EventType | string;
  layer: ObservabilityLayer;
  userId?: string | null;
  orgId?: string | null;
  traceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StartTraceParams {
  traceId: string;
  name?: string;
  userId?: string | null;
  websiteId?: string | null;
  scanId?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnrichErrorContext {
  layer: ObservabilityLayer;
  traceId?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnrichedError extends Error {
  observabilityContext: EnrichErrorContext;
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

const TRACE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Skip Postgres trace writes when callers pass placeholders like "unknown". */
function isPersistableTraceId(traceId: string | null | undefined): traceId is string {
  return typeof traceId === 'string' && TRACE_ID_RE.test(traceId);
}

function structuredConsole(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ...payload, ts: new Date().toISOString() }));
}

export async function logEvent(params: LogEventParams): Promise<void> {
  const entry = {
    type: params.type,
    layer: params.layer,
    userId: params.userId ?? null,
    orgId: params.orgId ?? null,
    traceId: params.traceId ?? null,
    metadata: params.metadata ?? {},
  };

  structuredConsole({ observability: 'event', ...entry });

  try {
    const supabase = createAdminClient();
    await supabase.from('system_logs').insert({
      type: params.type,
      layer: params.layer,
      user_id: params.userId ?? null,
      org_id: params.orgId ?? null,
      trace_id: isPersistableTraceId(params.traceId) ? params.traceId : null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        observability: 'logEvent_failed',
        error: err instanceof Error ? err.message : String(err),
        type: params.type,
        ts: new Date().toISOString(),
      }),
    );
  }
}

export async function startTrace(params: StartTraceParams): Promise<void> {
  structuredConsole({
    observability: 'trace_start',
    traceId: params.traceId,
    name: params.name ?? 'scan',
  });

  if (!isPersistableTraceId(params.traceId)) {
    return;
  }

  try {
    const supabase = createAdminClient();
    await supabase.from('traces').insert({
      trace_id: params.traceId,
      name: params.name ?? 'scan',
      user_id: params.userId ?? null,
      website_id: params.websiteId ?? null,
      scan_id: params.scanId ?? null,
      job_id: params.jobId ?? null,
      status: 'started',
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        observability: 'startTrace_failed',
        traceId: params.traceId,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  }
}

export async function addTraceStep(
  traceId: string,
  step: string,
  layer: ObservabilityLayer,
  metadata?: Record<string, unknown>,
  durationMs?: number,
): Promise<void> {
  structuredConsole({
    observability: 'trace_step',
    traceId,
    step,
    layer,
    durationMs: durationMs ?? null,
  });

  if (!isPersistableTraceId(traceId)) {
    return;
  }

  try {
    const supabase = createAdminClient();
    await supabase.from('trace_steps').insert({
      trace_id: traceId,
      step,
      layer,
      status: 'ok',
      duration_ms: durationMs ?? null,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        observability: 'addTraceStep_failed',
        traceId,
        step,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  }
}

export async function completeTrace(
  traceId: string,
  status: 'completed' | 'failed',
  metadata?: Record<string, unknown>,
): Promise<void> {
  structuredConsole({ observability: 'trace_complete', traceId, status });

  if (!isPersistableTraceId(traceId)) {
    return;
  }

  try {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {
      status,
      completed_at: new Date().toISOString(),
    };
    if (metadata && Object.keys(metadata).length > 0) {
      const { data: existing } = await supabase
        .from('traces')
        .select('metadata')
        .eq('trace_id', traceId)
        .maybeSingle();
      const merged = {
        ...((existing?.metadata as Record<string, unknown>) ?? {}),
        ...metadata,
      };
      update.metadata = merged;
    }

    await supabase.from('traces').update(update).eq('trace_id', traceId);
  } catch (err) {
    console.error(
      JSON.stringify({
        observability: 'completeTrace_failed',
        traceId,
        status,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  }
}

export async function recordMetric(
  name: string,
  value: number,
  dimensions?: Record<string, unknown>,
): Promise<void> {
  structuredConsole({
    observability: 'metric',
    metricName: name,
    metricValue: value,
    dimensions: dimensions ?? {},
  });

  try {
    const supabase = createAdminClient();
    await supabase.from('system_metrics').insert({
      metric_name: name,
      metric_value: value,
      dimensions: dimensions ?? {},
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        observability: 'recordMetric_failed',
        name,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  }
}

export function enrichError(err: unknown, context: EnrichErrorContext): EnrichedError {
  const base = err instanceof Error ? err : new Error(String(err));
  const enriched = new Error(base.message) as EnrichedError;
  enriched.name = base.name;
  enriched.stack = base.stack;
  enriched.observabilityContext = context;

  void logEvent({
    type: 'scan_failed',
    layer: context.layer,
    traceId: context.traceId,
    metadata: {
      ...context.metadata,
      jobId: context.jobId,
      error: base.message,
    },
  });

  return enriched;
}
