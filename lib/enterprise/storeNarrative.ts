import { createAdminClient } from '@/lib/supabase/admin';

import { generateSecurityNarrative } from './narrativeEngine';
import type { ScanFindingRow } from './scanDiff';
import type { PersistedScanRow } from '@/lib/report/intelligenceFromScan';
import type { PostureState } from './postureState';
import type { SecurityNarrative, StoredSecurityNarrative } from './narrativeTypes';

type ScanRowForNarrative = ScanFindingRow &
  PersistedScanRow & {
    org_id: string | null;
    websites?: { url: string } | { url: string }[] | null;
  };

export async function storeScanNarrative(params: {
  scanId: string;
  orgId: string;
  narrative: SecurityNarrative;
}): Promise<void> {
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const { error } = await admin.from('security_narratives').upsert(
    {
      scan_id: params.scanId,
      org_id: params.orgId,
      narrative: params.narrative,
      generated_at: generatedAt,
    },
    { onConflict: 'scan_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getStoredScanNarrative(
  scanId: string,
): Promise<StoredSecurityNarrative | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('security_narratives')
    .select('scan_id, org_id, narrative, generated_at')
    .eq('scan_id', scanId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    scan_id: data.scan_id,
    org_id: data.org_id,
    narrative: data.narrative as SecurityNarrative,
    generated_at: data.generated_at,
  };
}

export async function getLatestOrgScanNarrative(
  orgId: string,
): Promise<StoredSecurityNarrative | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('security_narratives')
    .select('scan_id, org_id, narrative, generated_at')
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    scan_id: data.scan_id,
    org_id: data.org_id,
    narrative: data.narrative as SecurityNarrative,
    generated_at: data.generated_at,
  };
}

/** Generate and persist narrative for a completed scan. */
export async function generateAndStoreScanNarrative(params: {
  scanId: string;
  orgId: string;
  rollingRiskScore: number | null;
  postureState: PostureState | null;
}): Promise<SecurityNarrative | null> {
  const admin = createAdminClient();

  const { data: scanRow, error: scanError } = await admin
    .from('scans')
    .select(
      'id, website_id, org_id, security_score, risk_level, ssl_valid, headers, issues, passed, explanation, scan_snapshot, completed_at, websites(url)',
    )
    .eq('id', params.scanId)
    .eq('status', 'completed')
    .single();

  if (scanError || !scanRow) {
    console.warn('[narrative] scan not found or incomplete', params.scanId, scanError?.message);
    return null;
  }

  const row = scanRow as ScanRowForNarrative;
  const website = Array.isArray(row.websites) ? row.websites[0] : row.websites;
  const url = website?.url ?? 'unknown';

  const { data: prevRows } = await admin
    .from('scans')
    .select('id, website_id, security_score, completed_at, issues')
    .eq('website_id', row.website_id)
    .eq('status', 'completed')
    .neq('id', params.scanId)
    .order('completed_at', { ascending: false })
    .limit(1);

  const previousScan = (prevRows?.[0] ?? null) as ScanFindingRow | null;

  const { data: anomalyRows } = await admin
    .from('org_anomalies')
    .select('type, severity, message, website_id')
    .eq('org_id', params.orgId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const orgAnomalies = (anomalyRows ?? []).map((a) => ({
    type: a.type,
    severity: a.severity,
    message: a.message,
    websiteId: a.website_id,
  }));

  const narrative = generateSecurityNarrative({
    scanRow: row,
    url,
    previousScan,
    orgAnomalies,
    rollingRiskScore: params.rollingRiskScore,
    postureState: params.postureState,
  });

  await storeScanNarrative({
    scanId: params.scanId,
    orgId: params.orgId,
    narrative,
  });

  console.log('[narrative_generated]', {
    scanId: params.scanId,
    orgId: params.orgId,
    urgency: narrative.urgency_level,
    keyEvents: narrative.key_events.length,
  });

  return narrative;
}
