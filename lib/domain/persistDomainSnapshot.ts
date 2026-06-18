import { createAdminClient } from '@/lib/supabase/admin';
import type { DomainSnapshotInfo } from './types';

export async function persistDomainSnapshot(params: {
  websiteId: string;
  scanId: string | null;
  snapshot: DomainSnapshotInfo;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { websiteId, scanId, snapshot } = params;

  const { data, error } = await supabase
    .from('domain_snapshots')
    .insert({
      website_id: websiteId,
      scan_id: scanId,
      domain: snapshot.domain,
      registrar: snapshot.registrar,
      expires_at: snapshot.expiresAt,
      days_until_expiry: snapshot.daysUntilExpiry,
      dns_records: snapshot.dnsRecords,
      checked_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[domain] persist snapshot failed:', error.message);
    return null;
  }

  return data?.id ?? null;
}

export interface StoredDomainSnapshot {
  id: string;
  domain: string;
  registrar: string | null;
  expires_at: string | null;
  days_until_expiry: number | null;
  dns_records: DomainSnapshotInfo['dnsRecords'];
  checked_at: string;
}

export async function fetchLatestDomainSnapshot(
  websiteId: string,
): Promise<StoredDomainSnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('domain_snapshots')
    .select('id, domain, registrar, expires_at, days_until_expiry, dns_records, checked_at')
    .eq('website_id', websiteId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as StoredDomainSnapshot;
}

export async function fetchPreviousDomainSnapshot(
  websiteId: string,
): Promise<StoredDomainSnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('domain_snapshots')
    .select('id, domain, registrar, expires_at, days_until_expiry, dns_records, checked_at')
    .eq('website_id', websiteId)
    .order('checked_at', { ascending: false })
    .limit(2);

  if (error || !data || data.length < 2) return null;
  return data[1] as StoredDomainSnapshot;
}
