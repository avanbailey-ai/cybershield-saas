import { getCanonicalOrgSecurityState } from './canonicalOrgSecurityState';

import type { OrgSecurityNarrative, SecurityNarrative } from './narrativeTypes';

import type { PostureState } from './postureState';



export type {

  RiskBucket,

  OrgAnomalyFeedItem,

  RiskDistribution,

  ClientGroupSummary,

} from './enterpriseTypes';



export {

  RISK_BUCKET_DISPLAY,

  scoreToRiskBucket,

  emptyRiskDistribution,

} from './enterpriseTypes';



export interface OrgDashboardSummary {

  orgId: string;

  totalSitesMonitored: number;

  riskDistribution: import('./enterpriseTypes').RiskDistribution;

  criticalAlertsCount: number;

  openAlertsCount: number;

  avgScore: number | null;

  rollingRiskScore: number | null;

  postureState: PostureState | null;

  anomalies: import('./enterpriseTypes').OrgAnomalyFeedItem[];

  sitesByClientGroup: import('./enterpriseTypes').ClientGroupSummary[];

  orgSecurityNarrative: OrgSecurityNarrative | null;

  latestScanNarrative: SecurityNarrative | null;

  latestScanNarrativeAt: string | null;

}



/** Thin wrapper — all aggregates sourced from canonical org security state. */

export async function getOrgDashboardSummary(orgId: string): Promise<OrgDashboardSummary> {

  const canonical = await getCanonicalOrgSecurityState(orgId);

  const { dashboard, security_narratives } = canonical;



  return {

    orgId,

    totalSitesMonitored: dashboard.totalSitesMonitored,

    riskDistribution: dashboard.riskDistribution,

    criticalAlertsCount: dashboard.criticalAlertsCount,

    openAlertsCount: dashboard.openAlertsCount,

    avgScore: dashboard.avgScore,

    rollingRiskScore: canonical.rollingRiskScore,

    postureState: canonical.postureState,

    anomalies: canonical.org_anomalies,

    sitesByClientGroup: dashboard.sitesByClientGroup,

    orgSecurityNarrative: security_narratives.org,

    latestScanNarrative: security_narratives.latestScan,

    latestScanNarrativeAt: security_narratives.latestScanAt,

  };

}

