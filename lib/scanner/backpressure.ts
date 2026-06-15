/**
 * Queue depth backpressure — warn at soft limit, reject at critical.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const BACKPRESSURE_WARNING_DEPTH = 50;
export const BACKPRESSURE_CRITICAL_DEPTH = 150;

export interface BackpressureConfig {
  warningDepth: number;
  criticalDepth: number;
}

export interface BackpressureResult {
  allowed: boolean;
  depth: number;
  /** True when queue is busy but enqueue is still allowed. */
  warning?: boolean;
  reason?: 'queue_full' | 'queue_busy';
  message?: string;
}

export function getBackpressureConfig(): BackpressureConfig {
  const warningDepth = parseEnvInt('SCAN_QUEUE_SOFT_LIMIT', BACKPRESSURE_WARNING_DEPTH);
  const criticalDepth = parseEnvInt('SCAN_QUEUE_MAX_DEPTH', BACKPRESSURE_CRITICAL_DEPTH);
  return {
    warningDepth: Math.max(1, warningDepth),
    criticalDepth: Math.max(Math.max(1, criticalDepth), warningDepth),
  };
}

function parseEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function checkQueueBackpressure(): Promise<BackpressureResult> {
  const { warningDepth, criticalDepth } = getBackpressureConfig();
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('scan_queue')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'processing']);

  if (error) {
    console.error('[backpressure] depth check failed', error);
    return { allowed: true, depth: 0 };
  }

  const depth = count ?? 0;

  if (depth >= criticalDepth) {
    return {
      allowed: false,
      depth,
      reason: 'queue_full',
      message:
        'Scan demand is very high right now. Please try again in a few minutes, or upgrade for priority processing.',
    };
  }

  if (depth >= warningDepth) {
    return {
      allowed: true,
      depth,
      warning: true,
      reason: 'queue_busy',
      message: 'High demand — scans may take longer than usual.',
    };
  }

  return { allowed: true, depth };
}
