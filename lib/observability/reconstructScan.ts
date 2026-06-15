/**
 * Debug reconstruction — aggregate scan, trace, steps, and logs for a scan id.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface ReconstructedScan {
  scan: Record<string, unknown> | null;
  trace: Record<string, unknown> | null;
  steps: Record<string, unknown>[];
  logs: Record<string, unknown>[];
}

export async function reconstructScan(scanId: string): Promise<ReconstructedScan> {
  const supabase = createAdminClient();

  const { data: scan } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .maybeSingle();

  const { data: trace } = await supabase
    .from('traces')
    .select('*')
    .eq('scan_id', scanId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let steps: Record<string, unknown>[] = [];
  let logs: Record<string, unknown>[] = [];

  const traceId = trace?.trace_id as string | undefined;

  if (traceId) {
    const { data: stepRows } = await supabase
      .from('trace_steps')
      .select('*')
      .eq('trace_id', traceId)
      .order('created_at', { ascending: true });

    steps = (stepRows ?? []) as Record<string, unknown>[];

    const { data: logRows } = await supabase
      .from('system_logs')
      .select('*')
      .eq('trace_id', traceId)
      .order('created_at', { ascending: true });

    logs = (logRows ?? []) as Record<string, unknown>[];
  }

  if (logs.length === 0) {
    const { data: scanLogs } = await supabase
      .from('system_logs')
      .select('*')
      .contains('metadata', { scanId })
      .order('created_at', { ascending: true });

    if (scanLogs?.length) {
      logs = scanLogs as Record<string, unknown>[];
    }
  }

  if (!trace && scan) {
    const websiteId = scan.website_id as string | undefined;
    const userId = scan.user_id as string | undefined;
    if (websiteId || userId) {
      let traceQuery = supabase.from('traces').select('*').order('started_at', { ascending: false }).limit(1);
      if (websiteId) traceQuery = traceQuery.eq('website_id', websiteId);
      if (userId) traceQuery = traceQuery.eq('user_id', userId);
      const { data: fallbackTrace } = await traceQuery.maybeSingle();
      if (fallbackTrace) {
        const fallbackTraceId = fallbackTrace.trace_id as string;
        const { data: stepRows } = await supabase
          .from('trace_steps')
          .select('*')
          .eq('trace_id', fallbackTraceId)
          .order('created_at', { ascending: true });
        steps = (stepRows ?? []) as Record<string, unknown>[];
        return {
          scan: scan as Record<string, unknown>,
          trace: fallbackTrace as Record<string, unknown>,
          steps,
          logs,
        };
      }
    }
  }

  return {
    scan: (scan as Record<string, unknown>) ?? null,
    trace: (trace as Record<string, unknown>) ?? null,
    steps,
    logs,
  };
}
