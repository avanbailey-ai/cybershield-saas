import { createAdminClient } from '@/lib/supabase/admin';
import type { SecurityReport } from './generateSecurityReport';

/** Hourly bucket for cache key stability within a time window. */
export function getTimestampBucket(date: Date = new Date()): number {
  return Math.floor(date.getTime() / (60 * 60 * 1000));
}

export function buildCacheKey(params: {
  websiteId: string | null;
  scanHash: string;
  bucket: number;
}): string {
  return `${params.websiteId ?? 'public'}:${params.scanHash}:${params.bucket}`;
}

export async function getCachedAiReport(params: {
  websiteId: string | null;
  scanHash: string;
  bucket: number;
}): Promise<SecurityReport | null> {
  const supabase = createAdminClient();
  const query = supabase
    .from('ai_report_cache')
    .select('report_json')
    .eq('scan_hash', params.scanHash)
    .eq('bucket', params.bucket);

  const { data, error } = params.websiteId
    ? await query.eq('website_id', params.websiteId).maybeSingle()
    : await query.is('website_id', null).maybeSingle();

  if (error) {
    console.warn('[reportCache] Cache read failed:', error.message);
    return null;
  }

  if (!data?.report_json) return null;
  return data.report_json as SecurityReport;
}

export async function setCachedAiReport(params: {
  websiteId: string | null;
  scanHash: string;
  bucket: number;
  report: SecurityReport;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ai_report_cache').upsert(
    {
      website_id: params.websiteId,
      scan_hash: params.scanHash,
      bucket: params.bucket,
      report_json: params.report,
    },
    { onConflict: 'website_id,scan_hash,bucket' },
  );

  if (error) {
    console.warn('[reportCache] Cache write failed:', error.message);
  }
}
