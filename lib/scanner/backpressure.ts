/**
 * Queue depth backpressure — reject or defer enqueue when the worker is overloaded.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface BackpressureConfig {
  maxDepth: number;
  softLimit: number;
}

export interface BackpressureResult {
  allowed: boolean;
  depth: number;
  reason?: 'queue_full' | 'queue_busy';
  message?: string;
}

export function getBackpressureConfig(): BackpressureConfig {
  const maxDepth = parseEnvInt('SCAN_QUEUE_MAX_DEPTH', 100);
  const softLimit = parseEnvInt('SCAN_QUEUE_SOFT_LIMIT', 50);
  return {
    maxDepth: Math.max(1, maxDepth),
    softLimit: Math.min(Math.max(1, softLimit), maxDepth),
  };
}

function parseEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function checkQueueBackpressure(): Promise<BackpressureResult> {
  const { maxDepth, softLimit } = getBackpressureConfig();
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

  if (depth >= maxDepth) {
    return {
      allowed: false,
      depth,
      reason: 'queue_full',
      message: 'The scan queue is at capacity. Please try again in a few minutes.',
    };
  }

  if (depth >= softLimit) {
    return {
      allowed: false,
      depth,
      reason: 'queue_busy',
      message: 'Scan queue is busy. Please wait a moment before starting another scan.',
    };
  }

  return { allowed: true, depth };
}
