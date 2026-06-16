import { createAdminClient } from '@/lib/supabase/admin';
import { detectAnomaliesFromScans, type DetectedAnomaly } from './anomalyDetection';
import { scoreToPostureState } from './postureState';
import {
  computeRollingRiskScore,
  type CompletedScanScoreRow,
} from './rollingRiskScore';
import type { ScanFindingRow } from './scanDiff';

export interface OrgIntelligenceSnapshot {
  orgId: string;
  rollingRiskScore: number | null;
  postureState: ReturnType<typeof scoreToPostureState>;
  anomaliesInserted: number;
}

type OrgRow = {
  rolling_risk_score: number | null;
  posture_state: string | null;
};

/** Recompute rolling risk, posture, and persist anomalies after a completed scan. */
export async function updateOrgIntelligence(orgId: string): Promise<OrgIntelligenceSnapshot> {
  const admin = createAdminClient();

  const [orgRes, scansRes] = await Promise.all([
    admin
      .from('organizations')
      .select('rolling_risk_score, posture_state')
      .eq('id', orgId)
      .single(),
    admin
      .from('scans')
      .select('id, website_id, security_score, completed_at, issues')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100),
  ]);

  if (orgRes.error) {
    throw new Error(orgRes.error.message);
  }
  if (scansRes.error) {
    throw new Error(scansRes.error.message);
  }

  const previousOrg = (orgRes.data ?? null) as OrgRow | null;
  const previousRollingScore = previousOrg?.rolling_risk_score ?? null;

  const findingScans = (scansRes.data ?? []) as ScanFindingRow[];
  const scoreScans = findingScans as CompletedScanScoreRow[];

  const rollingRiskScore = computeRollingRiskScore(scoreScans);
  const postureState = scoreToPostureState(rollingRiskScore);

  console.log('[rolling_risk_recalculated]', {
    orgId,
    rollingRiskScore,
    scanCount: scoreScans.filter((s) => s.security_score !== null).length,
    previousRollingScore,
  });

  if (postureState !== (previousOrg?.posture_state ?? null)) {
    console.log('[posture_updated]', {
      orgId,
      previous: previousOrg?.posture_state ?? null,
      next: postureState,
      rollingRiskScore,
    });
  }

  const detected = detectAnomaliesFromScans(scoreScans, findingScans, previousRollingScore);

  const { error: orgUpdateError } = await admin
    .from('organizations')
    .update({
      rolling_risk_score: rollingRiskScore,
      posture_state: postureState,
      intelligence_updated_at: new Date().toISOString(),
    })
    .eq('id', orgId);

  if (orgUpdateError) {
    throw new Error(orgUpdateError.message);
  }

  let anomaliesInserted = 0;

  if (detected.length > 0) {
    const { data: openAnomalies } = await admin
      .from('org_anomalies')
      .select('type, website_id, message')
      .eq('org_id', orgId)
      .eq('resolved', false);

    const openKeys = new Set(
      (openAnomalies ?? []).map(
        (row) =>
          `${row.type}:${row.website_id ?? 'org'}:${row.message}`,
      ),
    );

    const rowsToInsert = detected.filter((anomaly) => {
      const key = `${anomaly.type}:${anomaly.websiteId ?? 'org'}:${anomaly.message}`;
      return !openKeys.has(key);
    });

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await admin.from('org_anomalies').insert(
        rowsToInsert.map((anomaly: DetectedAnomaly) => ({
          org_id: orgId,
          website_id: anomaly.websiteId,
          type: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message,
          resolved: false,
        })),
      );

      if (insertError) {
        throw new Error(insertError.message);
      }

      anomaliesInserted = rowsToInsert.length;

      for (const anomaly of rowsToInsert) {
        console.log('[anomaly_detected]', {
          orgId,
          type: anomaly.type,
          severity: anomaly.severity,
          websiteId: anomaly.websiteId,
          message: anomaly.message,
        });
      }
    }
  }

  return {
    orgId,
    rollingRiskScore,
    postureState,
    anomaliesInserted,
  };
}
